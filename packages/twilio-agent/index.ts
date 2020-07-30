import {ApiDeps} from '@open-cc/api-common';
import {
  FlowObject,
  FlowProcessExecutor
} from '@open-cc/flow-processor';
import {flowService} from '@open-cc/flow-agent/src/common';
import * as twilio from 'twilio';
import * as debug from 'debug';
import {ExternalInteractionInitiatedEvent} from '@open-cc/core-api';
import {registerApp} from './src/twilio-setup';

const log = debug('');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NOTIFY_PHONE_NUMBER
} = process.env;

function buildUrl(...path : string[]) {
  return [process.env.PUBLIC_URL, ...path].join('/');
}

class TwimlFlowProcessExecutor implements FlowProcessExecutor {

  constructor(private apiDeps : ApiDeps, private twilioClient : twilio.Twilio) {
  }

  public async execute(command : string, ...args : any[]) : Promise<any> {
    switch (command) {
      case 'route': {
        const event = args[0];
        await this.apiDeps.stream('routing')
          .send(event.streamId, {...event, name: command});
        break;
      }
      case 'bridge': {
        const interactionId = args[0];
        const endpoint = `${args[1]}`.split(/\//).slice(-1)[0];
        const twi = new twilio.twiml.VoiceResponse();
        log('DEBUG-BRIDGE', interactionId, endpoint);
        twi
          .dial()
          .conference({
            waitUrl: '',
            statusCallback: buildUrl('api/broadcast/twilio?messageName=status_callback'),
            statusCallbackEvent: ['leave']
          }, interactionId);
        await this.twilioClient
          .calls
          .create({
            from: '+12723597403',
            to: endpoint,
            twiml: twi.toString()
          });
        break;
      }
    }
  }

  public async instantiate(type : string, ...args : any[]) : Promise<FlowObject> {
    switch (type) {
      case 'sound':
        return {
          id: 'moh',
          play:  () => {
            console.log('play???');
          },
          stop: () => {
            console.log('stop???');
          }
        } as FlowObject;
    }
    // @TODO - clean this up
    return {id: 'null'};
  }
}

export default async (apiDeps : ApiDeps) => {

  const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const incomingPhoneNumber = await registerApp(twilioClient,
    buildUrl('api/broadcast/twilio?messageName=call'),
    buildUrl('api/broadcast/twilio?messageName=status_callback'));

  log('Registered phone number', incomingPhoneNumber);

  if (TWILIO_NOTIFY_PHONE_NUMBER) {
    await twilioClient.messages
      .create({
        body: `App registered to: ${incomingPhoneNumber.phoneNumber}`,
        from: incomingPhoneNumber.phoneNumber,
        to: TWILIO_NOTIFY_PHONE_NUMBER
      });
  }

  /*
  AccountSid: 'AC04e361d76fec31a9e2c1d7db4accd61f',
     ApiVersion: '2010-04-01',
     CallSid: 'CAdc96208ac36f0036c72d066cb87163ce',
     CallStatus: 'ringing',
     Called: '+12723597403',
     CalledCity: '',
     CalledCountry: 'US',
     CalledState: 'PA',
     CalledZip: '',
     Caller: '+16105877376',
     CallerCity: 'READING',
     CallerCountry: 'US',
     CallerState: 'PA',
     CallerZip: '19611',
     Direction: 'inbound',
     From: '+16105877376',
     FromCity: 'READING',
     FromCountry: 'US',
     FromState: 'PA',
     FromZip: '19611',
     To: '+12723597403',
     ToCity: '',
     ToCountry: 'US',
     ToState: 'PA',
     ToZip: '' },
   */

  apiDeps
    .stream('twilio')
    .on('call', (msg: any) => {

      console.log(msg);

      // Notify interactions api of call
      apiDeps
        .stream('interactions')
        .send(msg.payload.CallSid, new ExternalInteractionInitiatedEvent(msg.payload.CallSid,
          'voice',
          msg.payload.Caller,
          msg.payload.Called));

      // Send caller to a conference
      const twi = new twilio.twiml.VoiceResponse();
      //twi.say({voice: 'alice'}, 'hello world!');
      twi.dial().conference({
        statusCallback: buildUrl('api/broadcast/twilio?messageName=status_callback'),
        statusCallbackEvent: ['leave', 'join']
      }, msg.payload.CallSid);

      return {
        http: {
          headers: {
            'Content-Type': 'text/xml'
          },
          body: twi.toString()
        }
      }
    })
    .on('status_callback', (msg) => {
      console.log(msg);
      return {
        http: {
          status: 200,
          body: ''
        }
      }
    });
  await flowService(process.env.FLOW,
    (apiDeps) => new TwimlFlowProcessExecutor(apiDeps, twilioClient))(apiDeps);
}

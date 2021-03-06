import {
  ApiDeps,
  MessageHeader
} from '@open-cc/api-common';
import {
  FlowModel,
  FlowObject,
  FlowProcessExecutor
} from '@open-cc/flow-processor';
import {flowService} from '@open-cc/flow-agent/src/common';
import * as twilio from 'twilio';
import * as debug from 'debug';
import {EventEmitter} from 'events';
import {
  ExternalInteractionEndedEvent,
  ExternalInteractionInitiatedEvent
} from '@open-cc/core-api';
import {TwimlBuilder} from './src/twiml-builder';
import {registerApp} from './src/twilio-setup';

const log = debug('');
const logDebug = log.extend('debug');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NOTIFY_PHONE_NUMBER
} = process.env;

const eventEmitter = new EventEmitter();

function buildUrl(...path : string[]) {
  return [process.env.PUBLIC_URL, ...path].join('/');
}

function buildTwimlPreparedSubject(streamId : string) {
  return `twiml-prepared-${streamId}`;
}

async function onEvent<T>(subject : string) : Promise<T> {
  return new Promise((resolve) => {
    logDebug('onEvent', subject);
    eventEmitter.once(subject, (data) => {
      logDebug('onEvent received data', subject, data);
      resolve(data);
    });
  });
}

class TwimlFlowProcessExecutor implements FlowProcessExecutor {

  private twimlBuilder : TwimlBuilder = new TwimlBuilder();

  constructor(private apiDeps : ApiDeps, private twilioClient : twilio.Twilio) {
  }

  public async execute(command : string, ...args : any[]) : Promise<any> {
    switch (command) {
      case 'route': {
        const event = args[0];
        this.twimlBuilder.conference(event.streamId, {
          statusCallback: buildUrl(`api/twilio/${encodeURIComponent('{body.CallSID}')}?messageName=status_callback`),
          statusCallbackEvent: ['leave', 'join']
        });
        await this.apiDeps.subject('routing')
          .send(event.streamId, {...event, name: command});
        break;
      }
      case 'bridge': {
        const interactionId = args[0];
        const endpoint = `${args[1]}`.split(/\//).slice(-1)[0];
        await this.twilioClient
          .calls
          .create({
            from: '+12723597403',
            to: endpoint,
            twiml: TwimlBuilder.create().conference(interactionId, {
              waitUrl: '',
              statusCallback: buildUrl(`api/twilio/${encodeURIComponent('{body.CallSID}')}?messageName=status_callback`),
              statusCallbackEvent: ['leave']
            }).buildVoiceResponse().toString()
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
          play: (streamId : string) => {
            this.twimlBuilder.say('moh', 'hello world', {
              voice: 'alice',
              language: 'en-GB'
            });
            this.twimlBuilder
              .conference(streamId, {waitUrl: 'https://twimlets.com/holdmusic?Bucket=com.twilio.music.electronica' });
          },
          stop: () => {
            // NoOp
          }
        } as FlowObject;
    }
    // @TODO - clean this up
    return {id: 'null'};
  }

  public getTwiml() : string {
    const response = this.twimlBuilder.buildVoiceResponse();
    this.twimlBuilder.reset();
    const twiml = response == null ? null : response.toString();
    logDebug('prepared twiml', twiml);
    return twiml;
  }
}

export default async (apiDeps : ApiDeps) => {

  const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const incomingPhoneNumber = await registerApp(twilioClient,
    buildUrl(`api/twilio/${encodeURIComponent('{body.CallSID}')}?messageName=call`),
    buildUrl(`api/twilio/${encodeURIComponent('{body.CallSID}')}?messageName=status_callback`));

  log('Registered phone number', incomingPhoneNumber);

  if (TWILIO_NOTIFY_PHONE_NUMBER) {
    await twilioClient.messages
      .create({
        body: `App registered to: ${incomingPhoneNumber.phoneNumber}`,
        from: incomingPhoneNumber.phoneNumber,
        to: TWILIO_NOTIFY_PHONE_NUMBER
      });
  }

  apiDeps
    .subject('twilio')
    .on('before', (msg : any, header : MessageHeader) => {
      log('%O', msg);
      const twilioSignature = header.http.headers['x-twilio-signature'] as string;
      if (!twilio.validateRequest(
        TWILIO_AUTH_TOKEN,
        twilioSignature,
        header.http.publicUrl,
        msg || {}
      )) {
        log('twilio request validation failed - ', twilioSignature, header.http.publicUrl, msg || {});
        return {
          http: {
            status: 401,
            headers: {
              'Content-Type': 'application/json'
            },
            body: {}
          }
        }
      }
    })
    .on('call', async (msg : any, header : MessageHeader) => {
      // Register subscription for twiml
      const twimlPromise = onEvent(buildTwimlPreparedSubject(msg.CallSid));
      // Notify interactions api of call
      await apiDeps
        .subject('interactions')
        .send(msg.CallSid, new ExternalInteractionInitiatedEvent(msg.CallSid,
          'voice',
          msg.Caller,
          msg.Called));

      const twiml = await twimlPromise;

      log('got twiml for', header.http.url, twiml);

      // Return twiml response
      return {
        http: {
          headers: {
            'Content-Type': 'text/xml'
          },
          body: twiml
        }
      };
    })
    .on('status_callback', async (msg : any) => {
      if (msg.CallStatus === 'completed') {
        // Notify interaction ended
        await apiDeps.subject('interactions')
          .send(msg.CallSid, new ExternalInteractionEndedEvent(msg.CallSid));
      }
      return {
        http: {
          status: 200,
          body: ''
        }
      }
    });

  await flowService(process.env.FLOW,
    () => new TwimlFlowProcessExecutor(apiDeps, twilioClient),
    (streamId : string, next : FlowModel) => {
      setTimeout(() => {
        const twiml = (next.executor as TwimlFlowProcessExecutor).getTwiml();
        if (twiml) {
          eventEmitter.emit(buildTwimlPreparedSubject(streamId), twiml);
        }
      }, 1);
    })(apiDeps);
}

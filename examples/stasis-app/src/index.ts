import {ApiDeps} from '@open-cc/api-common';
import * as Ari from 'ari-client';
import {
  Originate,
  stasisConnect,
  StasisConnection
} from '@open-cc/asterisk-stasis-container';
import * as debug from 'debug';

const log = debug('');

const asteriskURL = (process.env.ASTERISK_URL || 'http://asterisk:8088')
  .replace(/\${([^}]+)}/g, (s, m) => eval(m));
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

export default async ({router} : ApiDeps) => {
  log('Connecting to', asteriskURL);

  const connection : StasisConnection = await stasisConnect({
    url: asteriskURL,
    username: asteriskCredentials.split(/:/)[0],
    password: asteriskCredentials.split(/:/)[1],
    log: log.extend('stasis')
  });

  await router.register({
    stream: 'events',
    messageHandler: async (message : any) => {
      switch (message.name) {
        case 'RoutingCompleteEvent': {
          try {
            const channel : Ari.Channel = await connection.ari.channels.get({channelId: message.interactionId});
            try {
              // await channel.answer();
              new Originate(connection.ari, log, message.endpoint, channel, async () => {
                await router.send({
                  stream: 'interactions',
                  partitionKey: connection.asteriskId,
                  data: {
                    name: 'answered',
                    interactionId: message.interactionId,
                    endpoint: message.endpoint
                  }
                });
              }).execute();
            } catch (err) {
              log('Error answering incoming call', err);
            }
          } catch (err) {
            log(`Channel ${message.interactionId} not found`);
          }
          break;
        }
        case 'RoutingFailedEvent':
          const channel : Ari.Channel = await connection.ari.channels.get({channelId: message.interactionId});
          await channel.hangup();
          break;
      }
    }
  });

  setInterval(() => {
    // log('Checking endpoints');
    connection.ari.endpoints.list(
      async (err : Error, endpoints : Ari.Endpoint[]) => {
        if (err) {
          log('Failed to check endpoints', err);
        } else {
          try {
            await Promise.all(endpoints
              .filter(endpoint => !/^(kamailio|anonymous)$/.test(endpoint.resource))
              .map(endpoint => {
              const address : string = `${endpoint.technology}/${endpoint.resource}`;
              return router.send({
                stream: 'workers',
                partitionKey: connection.asteriskId,
                data: {
                  name: 'UpdateWorkerRegistration',
                  connected: endpoint.state === 'online',
                  workerId: address,
                  address,
                }
              });
            }));
          } catch (err) {
            log(`Failed to register endpoints - ${err.message}`);
          }
        }
      }
    );
  }, 1000);

  connection.registerStasisApp('example-stasis-app', async (stasisStartEvent : Ari.StasisStart, channel : Ari.Channel) => {
    log('Started example-stasis-app on', asteriskURL);
    channel.once('StasisEnd', async (stasisEndEvent : Ari.StasisEnd, channel : Ari.Channel) => {
      await router.send({
        stream: 'interactions',
        partitionKey: connection.asteriskId,
        data: {
          interactionId: channel.id,
          name: 'ended'
        }
      });
    });
    log('StasisStartedEvent', stasisStartEvent);
    await router.send({
      stream: 'interactions',
      partitionKey: connection.asteriskId,
      data: {
        name: 'started',
        source: stasisStartEvent.channel.name + '-' + stasisStartEvent.application,
        channel: 'voice',
        interactionId: channel.id,
        fromAddress: `PJSIP/${channel.caller.number}`,
        toAddress: stasisStartEvent.channel.dialplan.exten
      }
    });
  });

};


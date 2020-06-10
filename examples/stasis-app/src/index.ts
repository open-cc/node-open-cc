import {ApiDeps, envProp} from '@open-cc/api-common';
import * as Ari from 'ari-client';
import {
  Originate,
  stasisConnect,
  StasisConnection
} from '@open-cc/asterisk-stasis-container';
import * as debug from 'debug';

const log = debug('');

const asteriskURL = envProp(() => process.env.ASTERISK_URL, 'http://asterisk:8088');
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

                const ringPlay : Ari.Playback = await connection.ari.playbacks.get({playbackId: `${message.interactionId}-ring-play`});
                if (ringPlay) {
                  await ringPlay.stop();
                } else {
                  log('ring playback not found');
                }

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
          const ringPlay : Ari.Playback = await connection.ari.playbacks.get({playbackId: `${message.interactionId}-ring-play`});
          if (ringPlay) {
            await ringPlay.stop();
          } else {
            log('ring playback not found');
          }
          const channel : Ari.Channel = await connection.ari.channels.get({channelId: message.interactionId});
          await channel.hangup();
          break;
      }
    }
  });

  // setInterval(() => {
  //   connection.ari.endpoints.list(
  //     async (err : Error, endpoints : Ari.Endpoint[]) => {
  //       if (err) {
  //         log('Failed to check endpoints', err);
  //       } else {
  //         try {
  //           await Promise.all(endpoints
  //             .filter(endpoint => !/^(kamailio|anonymous)$/.test(endpoint.resource))
  //             .map(endpoint => {
  //             const address : string = `${endpoint.technology}/cluster/${endpoint.resource}`;
  //             return router.send({
  //               stream: 'workers',
  //               partitionKey: connection.asteriskId,
  //               data: {
  //                 name: 'UpdateWorkerRegistration',
  //                 connected: endpoint.state === 'online',
  //                 workerId: address,
  //                 address,
  //               }
  //             });
  //           }));
  //         } catch (err) {
  //           log(`Failed to register endpoints - ${err.message}`);
  //         }
  //       }
  //     }
  //   );
  // }, 1000);

  connection.registerStasisApp('example-stasis-app', async (stasisStartEvent : Ari.StasisStart, channel : Ari.Channel) => {
    log('Started example-stasis-app on', asteriskURL);
    if (channel.caller.number === 'anonymous') {
      log('Got anonymous call?');
      await channel.answer();
    } else {
      await channel.answer();
      try {
        await channel.playWithId({
          playbackId: `${channel.id}-ring-play`,
          media: 'tone:ring'
        });
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
      } catch (err) {
        log('Playback failed of ring', err);
      }
      log('StasisStartedEvent', stasisStartEvent);
      await router.send({
        stream: 'interactions',
        partitionKey: connection.asteriskId,
        data: {
          name: 'started',
          source: stasisStartEvent.channel.name + '-' + stasisStartEvent.application,
          channel: 'voice',
          interactionId: channel.id,
          fromAddress: `SIP/${channel.caller.number}`,
          toAddress: stasisStartEvent.channel.dialplan.exten
        }
      });
    }
  });

};


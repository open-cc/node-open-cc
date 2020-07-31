import {
  ApiDeps,
  envProp
} from '@open-cc/api-common';
import * as Ari from 'ari-client';
import {
  stasisConnect,
  StasisConnection
} from '@open-cc/asterisk-ari-connector';
import {
  ExternalInteractionPartyJoinedEvent,
  ExternalInteractionPartyLeftEvent,
  ExternalInteractionEndedEvent,
  ExternalInteractionInitiatedEvent,
  InteractionEndedEvent,
  RoutingFailedEvent
} from '@open-cc/core-api';
import * as debug from 'debug';

const log = debug('');
const logDebug = log.extend('debug');

const asteriskURL = envProp(() => process.env.ASTERISK_URL, 'http://asterisk:8088');
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

export default async ({stream} : ApiDeps) => {
  logDebug('Connecting to', asteriskURL);

  const connection : StasisConnection = await stasisConnect({
    url: asteriskURL,
    username: asteriskCredentials.split(/:/)[0],
    password: asteriskCredentials.split(/:/)[1],
    log: log.extend('stasis')
  });

  setInterval(async () => {
    if (process.env.DISPATCH_ADDRESS) {
      try {
        await stream('dispatcherlist')
          .broadcast({
            name: 'DestinationReported',
            address: process.env.DISPATCH_ADDRESS
          });
      } catch (err) {
        if (!/no matching service/i.test(err.message || '')) {
          throw err;
        }
      }
    }
  }, 1000);

  async function hangupChannel(channel : Ari.Channel, message : string) {
    logDebug(message);
    try {
      await channel.hangup();
    } catch (err) {
      log(`Failed to hang up channel ${channel.name}`);
    }
  }

  stream('events')
    .on(RoutingFailedEvent, async (event : RoutingFailedEvent) => {
      const channel : Ari.Channel = await connection.ari.channels.get({channelId: event.interactionId});
      await channel.hangup();
      // TODO - unregister stream(event.interactionId)
    })
    .on(InteractionEndedEvent, async (event : InteractionEndedEvent) => {
      await stream(event.streamId).unbind();
    });

  connection.registerStasisApp('example-stasis-app', async (stasisStartEvent : Ari.StasisStart, channel : Ari.Channel) => {
    logDebug('Started example-stasis-app on', asteriskURL);
    if (channel.caller.number === 'anonymous') {
      logDebug('Got anonymous call?');
      await channel.answer();
    } else {
      await channel.answer();
      channel.once('StasisEnd', async (stasisEndEvent : Ari.StasisEnd, channel : Ari.Channel) => {
        await stream('interactions')
          .send(connection.asteriskId, new ExternalInteractionEndedEvent(channel.id));
      });
      logDebug('StasisStartedEvent', stasisStartEvent);

      await stream(channel.id)
        .on('bridge', async (command : any) => {

          // TODO, this should be started earlier ?...
          try {
            const channel : Ari.Channel = await connection.ari.channels.get({channelId: command.interactionId});
            const bridge = await connection.ari.Bridge(command.interactionId)
              .createWithId({type: 'mixing'});
            logDebug(`Created bridge ${bridge.id}`);
            await bridge.addChannel({channel: [channel.id]});
          } catch (err) {
            log('Error getting channel', err);
          }

          let routingEndpoint : string = command.endpoint;
          const parts = /^sip:([^@]+)@(.*)/.exec(routingEndpoint);
          if (parts && parts.length > 0) {
            routingEndpoint = `SIP/${parts[2]}/${parts[1]}`;
          }

          logDebug('Routing to endpoint', routingEndpoint);

          const bridge : Ari.Bridge = await connection.ari.bridges.get({bridgeId: command.interactionId});
          const channel : Ari.Channel = await connection.ari.channels.get({channelId: command.interactionId});

          logDebug('Got bridge and original channel');

          const dialed = connection.ari.Channel();

          channel.on('StasisEnd', async (event : Ari.StasisEnd, channel : Ari.Channel) => {
            await hangupChannel(dialed, `Channel ${channel.name} left our application, hanging up dialed channel ${dialed.name}`);
          });

          dialed.on('ChannelDestroyed', async (event : Ari.ChannelDestroyed, dialed : Ari.Channel) => {
            // await hangupChannel(channel, `Dialed channel ${dialed.name} left our application, hanging up original channel ${channel.name}`);
          });

          dialed.on('StasisStart', async (stasisStartEvent : Ari.StasisStart, dialed : Ari.Channel) => {

            logDebug(`${stasisStartEvent.application} started`);

            bridge.on('ChannelLeftBridge', async (event : Ari.ChannelLeftBridge, instances : Ari.ChannelLeftBridge) => {
              logDebug(`Channel ${instances.channel.name} has left the bridge`, dialed);
              if (instances.channel.name === dialed.name) {
                await stream('interactions')
                  .send(connection.asteriskId,
                    new ExternalInteractionPartyLeftEvent(
                      command.interactionId,
                      routingEndpoint));
              }
              // await hangupChannel(channel, `Channel ${instances.channel.name} has left the bridge, hanging up ${channel.name}`);
            });

            dialed.on('StasisEnd', async (event : Ari.StasisEnd, dialed : Ari.Channel) => {
              logDebug(
                `Dialed channel ${dialed.name} has left our application`);
              // log(
              //   `Dialed channel ${dialed.name} has left our application, destroying bridge ${bridge.id}`);
              // await bridge.destroy();
            });

            logDebug('Waiting for dialed channel to answer');

            await dialed.answer();

            await stream('interactions')
              .send(connection.asteriskId,
                new ExternalInteractionPartyJoinedEvent(
                  command.interactionId,
                  routingEndpoint));

            logDebug(`Dialed channel ${dialed.name} has answered`);

            await bridge.addChannel({channel: [dialed.id]});
          });

          await dialed.originate({
            endpoint: routingEndpoint,
            app: 'bridge-dial',
            appArgs: 'dialed'
          });

          connection.ari.start('bridge-dial');
        })
        .on('startMoh', async (command : any) => {
          try {
            const channel : Ari.Channel = await connection.ari.channels.get({channelId: command.interactionId});
            if (channel) {
              try {
                await channel.startMoh();
              } catch (err) {
                log(`Failed to start moh`, err);
              }
            }
          } catch (err) {
            log(`Failed to get channel from`, command);
          }
        })
        .on('stopMoh', async (command : any) => {
          try {
            const channel : Ari.Channel = await connection.ari.channels.get({channelId: command.interactionId});
            if (channel) {
              try {
                await channel.stopMoh();
              } catch (err) {
                log(`Failed to stop moh`, err);
              }
            }
          } catch (err) {
            log(`Failed to get channel from`, command);
          }
        }).awaitRegistration();

      await stream('interactions')
        .send(connection.asteriskId,
          await new ExternalInteractionInitiatedEvent(
            channel.id,
            'voice',
            `SIP/${channel.caller.number}`,
            stasisStartEvent.channel.dialplan.exten));

    }
  });

};


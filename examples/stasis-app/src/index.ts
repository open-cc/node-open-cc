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
  CallInitiatedEvent,
  ExternalInteractionAnsweredEvent,
  ExternalInteractionEndedEvent,
  ExternalInteractionInitiatedEvent,
  RoutingCompleteEvent,
  RoutingFailedEvent
} from '@open-cc/core-api';
import * as debug from 'debug';

const log = debug('');

const asteriskURL = envProp(() => process.env.ASTERISK_URL, 'http://asterisk:8088');
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

export default async ({stream} : ApiDeps) => {
  log('Connecting to', asteriskURL);

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
    log(message);
    try {
      await channel.hangup();
    } catch (err) {
      log(`Failed to hang up channel ${channel.name}`);
    }
  }

  stream('events')
    .on(CallInitiatedEvent, async (event : CallInitiatedEvent) => {
      try {
        const channel : Ari.Channel = await connection.ari.channels.get({channelId: event.streamId});
        const bridge = await connection.ari.Bridge(event.streamId)
          .createWithId({type: 'mixing'});
        log(`Created bridge ${bridge.id}`);
        await bridge.addChannel({channel: [channel.id]});
        await channel.startMoh();
      } catch (err) {
        log('Error getting channel', err);
      }
    })
    .on(RoutingCompleteEvent, async (event : RoutingCompleteEvent) => {

      let routingEndpoint : string = event.endpoint;
      const parts = /^sip:([^@]+)@.*/.exec(routingEndpoint);
      if (parts && parts.length > 0) {
        routingEndpoint = `SIP/cluster/${parts[1]}`;
      }

      log('Routing to endpoint', routingEndpoint);

      const bridge : Ari.Bridge = await connection.ari.bridges.get({bridgeId: event.interactionId});
      const channel : Ari.Channel = await connection.ari.channels.get({channelId: event.interactionId});

      log('Got bridge and original channel');

      const dialed = connection.ari.Channel();

      channel.on('StasisEnd', async (event : Ari.StasisEnd, channel : Ari.Channel) => {
        await hangupChannel(dialed, `Channel ${channel.name} left our application, hanging up dialed channel ${dialed.name}`);
      });

      dialed.on('ChannelDestroyed', async (event : Ari.ChannelDestroyed, dialed : Ari.Channel) => {
        await hangupChannel(channel, `Dialed channel ${dialed.name} left our application, hanging up original channel ${channel.name}`);
      });

      dialed.on('StasisStart', async (stasisStartEvent : Ari.StasisStart, dialed : Ari.Channel) => {

        log(`${stasisStartEvent.application} started`);

        bridge.on('ChannelLeftBridge', async (event : Ari.ChannelLeftBridge, instances : Ari.ChannelLeftBridge) => {
          await hangupChannel(channel, `Channel ${instances.channel.name} has left the bridge, hanging up ${channel.name}`);
        });

        dialed.on('StasisEnd', async (event : Ari.StasisEnd, dialed : Ari.Channel) => {
          log(
            `Dialed channel ${dialed.name} has left our application, destroying bridge ${bridge.id}`);
          await bridge.destroy();
        });

        log('Waiting for dialed channel to answer');

        await dialed.answer();

        await stream('interactions')
          .send(connection.asteriskId,
            new ExternalInteractionAnsweredEvent(
              event.interactionId,
              routingEndpoint));

        log(`Dialed channel ${dialed.name} has answered`);

        try {
          await channel.stopMoh();
        } catch (err) {
          log(`Failed to stop moh`, err);
        }

        await bridge.addChannel({channel: [dialed.id]});
      });

      await dialed.originate({
        endpoint: routingEndpoint,
        app: 'bridge-dial',
        appArgs: 'dialed'
      });

      connection.ari.start('bridge-dial');
    })
    .on(RoutingFailedEvent, async (event : RoutingFailedEvent) => {
      const ringPlay : Ari.Playback = await connection.ari.playbacks.get({playbackId: `${event.interactionId}-ring-play`});
      if (ringPlay) {
        await ringPlay.stop();
      } else {
        log('ring playback not found');
      }
      const channel : Ari.Channel = await connection.ari.channels.get({channelId: event.interactionId});
      await channel.hangup();
    });

  connection.registerStasisApp('example-stasis-app', async (stasisStartEvent : Ari.StasisStart, channel : Ari.Channel) => {
    log('Started example-stasis-app on', asteriskURL);
    if (channel.caller.number === 'anonymous') {
      log('Got anonymous call?');
      await channel.answer();
    } else {
      await channel.answer();
      try {
        // await channel.playWithId({
        //   playbackId: `${channel.id}-ring-play`,
        //   media: 'tone:ring'
        // });
        channel.once('StasisEnd', async (stasisEndEvent : Ari.StasisEnd, channel : Ari.Channel) => {
          await stream('interactions')
            .send(connection.asteriskId, new ExternalInteractionEndedEvent(channel.id));
        });
      } catch (err) {
        log('Playback failed of ring', err);
      }
      log('StasisStartedEvent', stasisStartEvent);
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


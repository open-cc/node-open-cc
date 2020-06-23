import {
  ApiDeps,
  envProp
} from '@open-cc/api-common';
import * as Ari from 'ari-client';
import {
  Originate,
  stasisConnect,
  StasisConnection
} from '@open-cc/asterisk-stasis-container';
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

  stream('events')
    .on(CallInitiatedEvent, async (event : CallInitiatedEvent) => {
      // try {
      //   const channel : Ari.Channel = await connection.ari.channels.get({channelId: event.streamId});
      //   const bridge = connection.ari.Bridge(event.streamId);
      //   await bridge.createWithId({type: 'mixing'});
      //   bridge.addChannel({channel: [channel.id]});
      // }
    })
    .on(RoutingCompleteEvent, async (event : RoutingCompleteEvent) => {
      try {
        const channel : Ari.Channel = await connection.ari.channels.get({channelId: event.interactionId});
        try {
          let routingEndpoint : string = event.endpoint;
          const parts = /^sip:([^@]+)@.*/.exec(routingEndpoint);
          if (parts && parts.length > 0) {
            routingEndpoint = `SIP/cluster/${parts[1]}`;
          }
          new Originate(connection.ari, log, routingEndpoint, channel, async () => {
            const ringPlay : Ari.Playback = await connection.ari.playbacks.get({playbackId: `${event.interactionId}-ring-play`});
            if (ringPlay) {
              await ringPlay.stop();
            } else {
              log('ring playback not found');
            }
            await stream('interactions')
              .send(connection.asteriskId,
                new ExternalInteractionAnsweredEvent(
                  event.interactionId,
                  routingEndpoint));
          }).execute();
        } catch (err) {
          log('Error answering incoming call', err);
        }
      } catch (err) {
        log(`Channel ${event.interactionId} not found`);
      }
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
        await channel.playWithId({
          playbackId: `${channel.id}-ring-play`,
          media: 'tone:ring'
        });
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


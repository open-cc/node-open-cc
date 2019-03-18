import stasis from '@open-cc/asterisk-stasis-container';
import * as ariHelpers from '@open-cc/asterisk-ari-helpers';

const asteriskURL = process.env.ASTERISK_URL || 'http://asterisk:8088';
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

export default ({router, log}) => {

  log('connecting to', asteriskURL);

  stasis({
    url: asteriskURL,
    username: asteriskCredentials.split(/:/)[0],
    password: asteriskCredentials.split(/:/)[1],
    log
  }).register('example-stasis-app', (ari) => (event, channel) => {

    log('connected to', asteriskURL);

    const helpers = ariHelpers(ari);

    log('started example-stasis-app');

    channel.once('StasisEnd', () => {
      router.send({
        stream: 'interactions',
        partitionKey: channel.id,
        data: {
          interactionId: channel.id,
          name: 'ended'
        }
      });
    });

    router.send({
      stream: 'interactions',
      partitionKey: channel.id,
      data: {
        name: 'started',
        channel: 'voice',
        interactionId: channel.id,
        fromPhoneNumber: channel.caller.number,
        toPhoneNumber: channel.connected.number
      }
    });

    router.register('events', async (event) => {
      log('got event', event);
      switch (event.name) {
        case 'RoutingCompleteEvent': {
          const channel = await ari.channels.get({channelId: event.streamId});
          log('got channel', channel);
          helpers.originate(
            event.endpoint,
            channel, {
              onAnswer() {
                log('got answer', channel);
                router.send({
                  stream: 'interactions',
                  partitionKey: channel.id,
                  data: {
                    name: 'answered',
                    interactionId: channel.id,
                    endpoint: event.endpoint
                  }
                });
              }
            });
          break;
        }
      }
    });

  });
};

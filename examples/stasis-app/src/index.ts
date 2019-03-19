import stasis, {stasisApp} from '@open-cc/asterisk-stasis-container';
import * as ari from 'ari-client';
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
  }, (ari : ari.ARI) => {

    router.register('events', async (event) => {
      log('Got event', event);
      switch (event.name) {
        case 'RoutingCompleteEvent': {
          const channel = await ari.channels.get({channelId: event.streamId});
          log('Got channel', channel.id);
          ariHelpers(ari, {log}).originate(
            event.endpoint,
            channel, {
              onAnswer() {
                log('Got answer', channel.id);
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

    return stasisApp('example-stasis-app', (event : any, channel : ari.Channel) => {

      log('started example-stasis-app on', asteriskURL);

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

    });
  });
};

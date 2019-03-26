import stasis, {stasisApp} from '@open-cc/asterisk-stasis-container';
import * as ari from 'ari-client';
import * as ariHelpers from '@open-cc/asterisk-ari-helpers';

const asteriskURL = (process.env.ASTERISK_URL || 'http://asterisk:8088')
  .replace(/\${([^}]+)}/g, (s, m) => eval(m));
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
          try {
            const channel = await ari.channels.get({channelId: event.streamId});
            log('Got channel', channel.id);
            channel.answer((err : Error) => {
              if (err) {
                log('Error answering incoming call', err);
              } else {
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
              }
            });
          } catch (err) {
            log.error(`Channel ${event.streamId} not found`);
          }
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

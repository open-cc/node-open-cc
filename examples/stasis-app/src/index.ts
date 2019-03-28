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


    setInterval(() => {
      ari.endpoints.list(
        (err : Error, endpoints : ari.Endpoint[]) => {
          endpoints.forEach((endpoint : ari.Endpoint) => {
            const address : string = `${endpoint.technology}/${endpoint.resource}`;
            router.broadcast({
              stream: 'workers',
              data: {
                name: 'register',
                connected: endpoint.state === 'online',
                address,
              }
            })
          });
        }
      );
    }, 1000);

    router.register('events', async (event) => {
      log('Got event', event);
      switch (event.name) {
        case 'RoutingCompleteEvent': {
          try {
            const channel : ari.Channel = await (ari.channels.get({channelId: event.streamId}) as Promise<ari.Channel>);
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
        case 'RoutingFailedEvent':
          const channel : ari.Channel = await (ari.channels.get({channelId: event.streamId}) as Promise<ari.Channel>);
          log('Got channel', channel.id);
          channel.hangup();
          break;
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

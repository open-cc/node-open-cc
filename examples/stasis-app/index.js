const stasis = require('@open-cc/asterisk-stasis-container');
const ariHelpers = require('@open-cc/asterisk-ari-helpers');
const asteriskURL = process.env.ASTERISK_URL || 'http://asterisk:8088';
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

module.exports = ({router, log}) => {

  log('connecting to', asteriskURL);

  stasis(asteriskURL, {
    auth: {
      username: asteriskCredentials.split(/:/)[0],
      password: asteriskCredentials.split(/:/)[1]
    }
  }).then(ari => {

    log('connected to', asteriskURL);

    const helpers = ariHelpers(ari);

    ari.start('example-stasis-app', (event, channel) => {
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
    });

    router.register('events', (event) => {
      log('got event', event);
      switch (event.name) {
        case 'RoutingCompleteEvent': {
          ari.channels
            .get({channelId: event.streamId})
            .then(channel => {
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
            })
            .catch(err => {
              log(err);
            });
          break;
        }
      }
    });
  }).catch(err => {
    log(err);
  });

};

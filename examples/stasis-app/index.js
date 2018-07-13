const stasis = require('@open-cc/asterisk-stasis-container');
const ariHelpers = require('@open-cc/asterisk-ari-helpers');
const asteriskURL = process.env.ASTERISK_URL || 'http://asterisk:8088';
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

module.exports = router => {

    stasis(asteriskURL, {
        auth: {
            username: asteriskCredentials.split(/:/)[0],
            password: asteriskCredentials.split(/:/)[1]
        }
    }).then(ari => {

        const helpers = ariHelpers(ari);

        ari.start('example-stasis-app', (event, channel) => {
            channel.once('StasisEnd', () => {
                router.send({
                    stream: 'interactions',
                    partitionKey: channel.id,
                    interactionId: channel.id,
                    name: 'ended'
                });
            });
            router.send({
                stream: 'interactions',
                partitionKey: channel.id,
                name: 'started',
                channel: 'voice',
                interactionId: channel.id,
                fromPhoneNumber: channel.caller.number,
                toPhoneNumber: channel.connected.number
            });
        });

        router.register('events', message => {
            switch (message.event.name) {
                case 'RoutingCompleteEvent':
                {
                    ari.channels
                        .get({channelId: message.partitionKey})
                        .then(channel => {
                            helpers.originate(
                                message.event.endpoint,
                                channel, {
                                    onAnswer() {
                                        router.send({
                                            stream: 'interactions',
                                            partitionKey: channel.id,
                                            name: 'answered',
                                            interactionId: channel.id,
                                            endpoint: message.event.endpoint
                                        });
                                    }
                                });
                        })
                        .catch(err => {
                            console.error(err);
                        });
                    break;
                }
            }
        });
    }).catch(err => {
        console.error(err);
    });

};
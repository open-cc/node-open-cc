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

            channel.once('StasisEnd', (event, obj) => {
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
                case 'CallInitiatedEvent':
                {
                    ari.channels
                        .get({channelId: message.partitionKey})
                        .then(channel => {

                            /*-
                            const playback = ari.Playback();
                            channel.play({media: 'sound:beep'},
                                playback, err => {
                                    if (err) {
                                        throw err;
                                    }
                                });
                            playback.once('PlaybackFinished', () => {
                                channel.hangup(err => {
                                    if (err) {
                                        console.error(err.message);
                                    }
                                });
                            });*/

                            helpers.originate(
                                'SIP/1002',
                                channel, {
                                    onAnswer() {
                                        console.log('answered');
                                        router.send({
                                            stream: 'interactions',
                                            partitionKey: channel.id,
                                            name: 'answered',
                                            interactionId: channel.id,
                                            endpoint: 'SIP/1002'
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
const stasis = require('@open-cc/asterisk-stasis-container');
const helpers = require('@open-cc/asterisk-ari-helpers');
const asteriskURL = process.env.ASTERISK_URL || 'http://asterisk:8088';
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

module.exports = (router, es) => {

    stasis(asteriskURL, {
        auth: {
            username: asteriskCredentials.split(/:/)[0],
            password: asteriskCredentials.split(/:/)[1]
        }
    }).then(ari => {

        return ari.start('example-stasis-app', (event, channel) => {

            router.send({
                stream: 'interactions',
                partitionKey: channel.id,
                name: 'started',
                interactionId: channel.id,
                fromPhoneNumber: channel.caller.number,
                toPhoneNumber: channel.connected.number
            });

            setTimeout(() => {
                channel.hangup(function (err) {
                    if (err) {
                        console.log(err.message);
                    }
                });
            }, 1000);

            /*-
            const playback = ari.Playback();

            channel.play({media: 'sound:tt-monkeys'},
                playback, err => {
                    if (err) {
                        throw err;
                    }
                });

            playback.on('PlaybackFinished', () => {
                console.log('playback finished');
                channel.hangup(function (err) {
                    if (err) {
                        console.log(err.message);
                    }
                });
            });*/

        });
    }).catch(err => {
        console.log(err);
    });

};
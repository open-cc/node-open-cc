const stasis = require('@open-cc/asterisk-stasis-container');
const helpers = require('@open-cc/asterisk-ari-helpers');
const asteriskURL = process.env.ASTERISK_URL || 'http://asterisk:8088';
const asteriskCredentials = process.env.ASTERISK_CREDS || '';

stasis(asteriskURL, {
    auth: {
        username: asteriskCredentials.split(/:/)[0],
        password: asteriskCredentials.split(/:/)[1]
    }
}).then(ari => {
    return ari.start('example-stasis-app', (event, channel) => {
        console.log('app started', event, channel);

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
        });

    });
}).catch(err => {
    console.log(err);
});
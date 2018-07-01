const debug = require('debug')('asterisk-stasis-container');

exports.connect = (ariClient, superagent) => (asteriskURL, config) => {
    config = config || {};
    config.maxConnectAttempts = config.maxConnectAttempts || 30;
    config.connectAttemptInterval = config.connectAttemptInterval || 1000;
    return new Promise((resolve, reject) => {
        const init = (attempt) => {
            debug(`Attempting to connect to ${asteriskURL} [${attempt} of ${config.maxConnectAttempts}]`);
            attempt = typeof attempt === 'undefined' ? 0 : attempt;
            superagent
                .get(`${asteriskURL}/ari/asterisk/info`)
                .auth(config.auth.username, config.auth.password)
                .then(() => {
                    ariClient.connect(
                        asteriskURL,
                        config.auth.username,
                        config.auth.password, (err, ari) => {
                            if (err) {
                                reject(err);
                            } else {
                                debug(`Connected to ${asteriskURL}`);
                                resolve(ari);
                            }
                        });
                })
                .catch(err => {
                    if (config.maxConnectAttempts === attempt) {
                        reject(err);
                    } else {
                        setTimeout(() => {
                            init(attempt + 1)
                        }, config.connectAttemptInterval);
                    }
                });
        };
        init();
    });
};

exports.initializeStarter = (connection) => {
    return connection
        .then(ari => {
            ari.__start = ari.start;
            ari.start = (appName, handler) => {
                ari.on('StasisStart', handler);
                ari.__start.bind(ari)(appName);
                return Promise.resolve(ari);
            };
            return ari;
        });
};
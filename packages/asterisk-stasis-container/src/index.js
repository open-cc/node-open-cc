const ari = require('ari-client');
const superagent = require('superagent');
const coreInit = require('./core/init');

exports.__init = (coreInit, asteriskURL, config) => {
    return coreInit
        .initializeStarter(
            coreInit
                .connect(ari, superagent)(asteriskURL, config));
};

exports.init = (asteriskURL, config) => {
    return exports.__init(coreInit, asteriskURL, config);
};
const ari = require('ari-client');
const superagent = require('superagent');
const coreInit = require('./core/init');
const init = (coreInit, asteriskURL, config) => {
    return coreInit
        .initializeStarter(
            coreInit
                .connect(ari, superagent)(asteriskURL, config));
};
/**
 * Initializes an ari client.
 * @param asteriskURL {string}
 * @param config
 * @returns {Promise<any>}
 */
const def = (asteriskURL, config) => {
    return init(coreInit, asteriskURL, config);
};
def.__init = init;
module.exports =  def;

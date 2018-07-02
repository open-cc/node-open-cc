const ari = require('ari-client');
const superagent = require('superagent');
const coreInit = require('./core/init');
const init = (coreInit, asteriskURL, config) => {
    return coreInit
        .initializeStarter(
            coreInit
                .connect(ari, superagent)(asteriskURL, config));
};
const def= (asteriskURL, config) => {
    return init(coreInit, asteriskURL, config);
};
def.__init = init;
module.exports =  def;
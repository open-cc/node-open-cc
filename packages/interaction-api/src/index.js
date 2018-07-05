const calls = require('./core/call');
const projections = require('./core/projections');
const debug = require('debug')('interaction-api');

module.exports = (router, es) => {

    debug('interaction-api started');

    const interactionServices = {
        voice: new calls.CallService(es.entityRepository)
    };

    projections.init(es.eventBus);

    router.register('interactions', message => {
        debug('interactions', message);
        switch (message.name) {
            case 'started':
            {
                if ('voice' === message.channel) {
                    interactionServices.voice.initiateCall(
                        message.interactionId,
                        message.fromPhoneNumber,
                        message.toPhoneNumber);
                }
                break;
            }
            case 'ended':
            {
                const channel = projections.findInteraction(message.interactionId).channel;
                interactionServices[channel]
                    .endInteraction(message.interactionId);
                break;
            }
            case 'get':
            {
                return projections.listInteractions(message.channel);
            }
            default:
            {
                return {message: 'unknown command'};
            }
        }
    });

};
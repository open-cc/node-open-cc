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
                const interactionModel = projections.findInteraction(message.interactionId);
                if (interactionModel) {
                    const channel = interactionModel.channel;
                    interactionServices[channel]
                        .endInteraction(message.interactionId);
                } else {
                    console.log(`interaction ${message.interactionId} not found`);
                }
                break;
            }
            case 'answered':
            {
                const interactionModel = projections.findInteraction(message.interactionId);
                if (interactionModel) {
                    const channel = interactionModel.channel;
                    interactionServices[channel].answer(message.interactionId, message.endpoint);
                } else {
                    console.log(`interaction ${message.interactionId} not found`);
                }
                break;
            }
            default:
            {
                return {message: 'unknown command' + message.name};
            }
        }
    });

};
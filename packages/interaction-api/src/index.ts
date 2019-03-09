import { CallService } from './core/call';
import * as projections from './core/projections';

export default ({router, entityRepository, eventBus, log}) => {
  log('interaction-api started');

  const interactionServices = {
    voice: new CallService(entityRepository)
  };

  projections.init(eventBus);

  router.register('interactions', message => {
    log('interactions', message);
    switch (message.name) {
      case 'started': {
        if ('voice' === message.channel) {
          interactionServices
            .voice
            .initiateCall(
              message.interactionId,
              message.fromPhoneNumber,
              message.toPhoneNumber)
            .then(() => {
            });
        }
        break;
      }
      case 'ended': {
        const interactionModel = projections.findInteraction(message.interactionId);
        if (interactionModel) {
          const channel = interactionModel.channel;
          interactionServices[channel]
            .endInteraction(message.interactionId)
            .then(() => {
            });
        } else {
          log(`interaction ${message.interactionId} not found`);
        }
        break;
      }
      case 'answered': {
        const interactionModel = projections.findInteraction(message.interactionId);
        if (interactionModel) {
          const channel = interactionModel.channel;
          interactionServices[channel]
            .answer(message.interactionId, message.endpoint)
            .then(() => {
            });
        } else {
          log(`interaction ${message.interactionId} not found`);
        }
        break;
      }
      case 'get': {
        return projections.listInteractions();
      }
      default: {
        return {message: 'unknown command ' + message.name};
      }
    }
    return {message: 'accepted ' + message.name};
  });

};

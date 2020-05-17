import {ApiDeps} from '@open-cc/api-common';
import {CallService} from './core/call';
import * as projections from './core/projections';
import * as debug from 'debug';

const log = debug('');

export {
  CallInitiatedEvent,
} from './core/call';

export default async ({router, entityRepository, eventBus} : ApiDeps) => {
  log('interaction-api started');

  const interactionServices = {
    voice: new CallService(entityRepository)
  };

  projections.init(eventBus);

  await router.register( {
    stream: 'interactions',
    messageHandler: async (message : any) => {
      log(`interactions ${JSON.stringify(message, null, 2)}`);
      switch (message.name) {
        case 'started': {
          if ('voice' === message.channel) {
            await interactionServices
              .voice
              .initiateCall(
                message.interactionId,
                message.fromAddress,
                message.toAddress);
          }
          break;
        }
        case 'ended': {
          const interactionModel = projections.findInteraction(message.interactionId);
          if (interactionModel) {
            const channel = interactionModel.channel;
            await interactionServices[channel]
              .endInteraction(message.interactionId);
          } else {
            log(`Unable to end interaction, ${message.interactionId} not found`);
          }
          break;
        }
        case 'answered': {
          const interactionModel = projections.findInteraction(message.interactionId);
          if (interactionModel) {
            const channel = interactionModel.channel;
            await interactionServices[channel]
              .answer(message.interactionId, message.endpoint);
          } else {
            log(`Unable to answer interaction, ${message.interactionId} not found`);
          }
          break;
        }
        case 'get': {
          return projections.listInteractions();
        }
        default: {
          return {message: `Unknown message ${message.name}`};
        }
      }
      return {message: `Accepted ${message.name}`};
    }
  });

};
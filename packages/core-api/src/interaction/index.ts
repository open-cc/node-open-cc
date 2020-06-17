import {ApiDeps} from '@open-cc/api-common';
import {CallService} from './core/call';
import * as projections from './core/projections';
import * as debug from 'debug';
import {
  ExternalInteractionEndedEvent,
  ExternalInteractionInitiatedEvent,
  ExternalInteractionAnsweredEvent
} from './core/interaction';

const log = debug('');

export {
  CallInitiatedEvent,
} from './core/call';

export default async ({stream, entityRepository, eventBus} : ApiDeps) => {
  log('interaction-api started');

  const interactionServices = {
    voice: new CallService(entityRepository)
  };

  projections.init(eventBus);

  stream('interactions')
    .on(ExternalInteractionInitiatedEvent, async (message : ExternalInteractionInitiatedEvent) => {
      if ('voice' === message.channel) {
        await interactionServices
          .voice
          .initiateCall(
            message.interactionId,
            message.fromAddress,
            message.toAddress);
      }
    })
    .on(ExternalInteractionEndedEvent, async (message : ExternalInteractionEndedEvent) => {
      const interactionModel = projections.findInteraction(message.interactionId);
      if (interactionModel) {
        const channel = interactionModel.channel;
        await interactionServices[channel]
          .endInteraction(message.interactionId);
      } else {
        log(`Unable to end interaction, ${message.interactionId} not found`);
      }
    })
    .on(ExternalInteractionAnsweredEvent, async (message : ExternalInteractionAnsweredEvent) => {
      const interactionModel = projections.findInteraction(message.interactionId);
      if (interactionModel) {
        const channel = interactionModel.channel;
        await interactionServices[channel]
          .answer(message.interactionId, message.endpoint);
      } else {
        log(`Unable to answer interaction, ${message.interactionId} not found`);
      }
    })
    .on('get', () => projections.listInteractions());

};

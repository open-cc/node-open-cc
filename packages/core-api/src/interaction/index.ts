import {ApiDeps} from '@open-cc/api-common';
import {CallService} from './core/call';
import * as projections from './core/projections';
import * as debug from 'debug';
import {
  ExternalInteractionEndedEvent,
  ExternalInteractionInitiatedEvent,
  ExternalInteractionPartyJoinedEvent,
  ExternalInteractionPartyLeftEvent,
  InteractionService
} from './core/interaction';

const log = debug('');

export {
  CallInitiatedEvent,
} from './core/call';

export default async ({stream, entityRepository, eventBus} : ApiDeps) => {
  log('interaction-api started');

  const interactionServices : { voice : CallService } = {
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
        await (interactionServices[channel] as InteractionService)
          .endInteraction(message.interactionId);
      } else {
        log(`Unable to end interaction, ${message.interactionId} not found`);
      }
    })
    .on(ExternalInteractionPartyJoinedEvent, async (message : ExternalInteractionPartyJoinedEvent) => {
      const interactionModel = projections.findInteraction(message.interactionId);
      if (interactionModel) {
        const channel = interactionModel.channel;
        await (interactionServices[channel] as InteractionService)
          .addParty(message.interactionId, message.endpoint);
      } else {
        log(`Unable to add party to interaction, ${message.interactionId} not found`);
      }
    })
    .on(ExternalInteractionPartyLeftEvent, async (message : ExternalInteractionPartyLeftEvent) => {
      const interactionModel = projections.findInteraction(message.interactionId);
      if (interactionModel) {
        const channel = interactionModel.channel;
        await (interactionServices[channel] as InteractionService)
          .removeParty(message.interactionId, message.endpoint);
      } else {
        log(`Unable to remove party from interaction, ${message.interactionId} not found`);
      }
    })
    .on('get', () => projections.listInteractions());

};

import {
    InteractionPartyJoinedEvent,
    InteractionEndedEvent,
    InteractionInitiatedEvent
} from './interaction';

import {CallInitiatedEvent} from './call';
import {
    EntityEvent,
    EventBus
} from 'ddd-es-node';

const interactionsView = {};

export const init = (eventBus : EventBus) => {
    eventBus.subscribe((event : EntityEvent) => {
        if (event instanceof InteractionInitiatedEvent) {
            interactionsView[event.streamId] = interactionsView[event.streamId] || {id: event.streamId};
            interactionsView[event.streamId].channel = event.channel;
            interactionsView[event.streamId].startedOn = event.timestamp;
            if (event instanceof CallInitiatedEvent) {
                interactionsView[event.streamId].fromAddress = event.fromAddress;
                interactionsView[event.streamId].toAddress = event.toAddress;
            }
        } else if (event instanceof InteractionPartyJoinedEvent) {
            if (interactionsView[event.streamId]) {
                interactionsView[event.streamId].answeredOn = event.timestamp;
            }
        } else if (event instanceof InteractionEndedEvent) {
            if (interactionsView[event.streamId]) {
                interactionsView[event.streamId].endedOn = event.timestamp;
            }
        }
    }, {replay: true});
};

export const findInteraction = (interactionId : string) => {
    return interactionsView[interactionId];
};

export const listInteractions = (channel? : string) => {
    return Object.keys(interactionsView)
        .map(interactionId => interactionsView[interactionId])
        .filter(interaction => {
            return typeof channel === 'undefined' || interaction.channel === channel;
        });
};

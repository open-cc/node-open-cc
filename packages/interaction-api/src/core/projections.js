const interactions = require('./interaction');
const calls = require('./call');

const interactionsView = {};

exports.init = (eventBus) => {
    eventBus.subscribe((event) => {
        if (event instanceof interactions.InteractionInitiatedEvent) {
            interactionsView[event.streamId] = interactionsView[event.streamId] || {id: event.streamId};
            interactionsView[event.streamId].channel = event.channel;
            interactionsView[event.streamId].startedOn = event.timestamp;
            if (event instanceof calls.CallInitiatedEvent) {
                interactionsView[event.streamId].fromPhoneNumber = event.fromPhoneNumber;
                interactionsView[event.streamId].toPhoneNumber = event.toPhoneNumber;
            }
        } else if (event instanceof interactions.InteractionAnsweredEvent) {
            if (interactionsView[event.streamId]) {
                interactionsView[event.streamId].answeredOn = event.timestamp;
            }
        } else if (event instanceof interactions.InteractionEndedEvent) {
            if (interactionsView[event.streamId]) {
                interactionsView[event.streamId].endedOn = event.timestamp;
            }
        }
    }, {replay: true});
};

exports.findInteraction = (interactionId) => {
    return interactionsView[interactionId];
};

exports.listInteractions = (channel) => {
    return Object.keys(interactionsView)
        .map(interactionId => interactionsView[interactionId])
        .filter(interaction => {
            return typeof channel === 'undefined' || interaction.channel === channel;
        });
};

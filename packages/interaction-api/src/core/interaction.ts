import {
    Entity,
    EntityEvent,
    EntityRepository
} from 'ddd-es-node';

export class InteractionEvent extends EntityEvent {
    constructor() {
        super();
    }
}

export class InteractionInitiatedEvent extends InteractionEvent {
    constructor(public readonly channel : string) {
        super();
    }
}

export class InteractionPlacedOnHoldEvent extends InteractionEvent {
    constructor() {
        super();
    }
}

export class InteractionRoutedEvent extends InteractionEvent {
    constructor(public readonly endpoint : string) {
        super();
    }
}

export class InteractionAnsweredEvent extends InteractionEvent {
    constructor(public readonly endpoint : string) {
        super();
    }
}

export class InteractionEndedEvent extends InteractionEvent {
    constructor() {
        super();
    }
}

export class Interaction extends Entity {
    constructor(id, protected channel : string, applier) {
        super(id, applier);
        this.channel = channel;
    }

    public placeOnHold() {
        this.dispatch(new InteractionPlacedOnHoldEvent());
    }

    public routeTo(endpoint) {
        this.dispatch(new InteractionRoutedEvent(endpoint));
    }

    public answer(endpoint) {
        this.dispatch(new InteractionAnsweredEvent(endpoint));
    }

    public end() {
        this.dispatch(new InteractionEndedEvent());
    }

}

export class InteractionService {
    constructor(protected entityRepository : EntityRepository,
                private interactionType : any) {
    }

    public placeOnHold(interactionId) {
        return this.entityRepository.load(this.getInteractionType(), interactionId)
            .then((interaction : Interaction) => {
                interaction.placeOnHold();
            });
    }

    public routeTo(interactionId, endpoint) {
        return this.entityRepository.load(this.getInteractionType(), interactionId)
            .then((interaction : Interaction) => {
                interaction.routeTo(endpoint);
            });
    }

    public answer(interactionId, answeredByEndpoint) {
        return this.entityRepository.load(this.getInteractionType(), interactionId)
            .then((interaction : Interaction) => {
                interaction.answer(answeredByEndpoint);
            });
    }

    public endInteraction(interactionId) {
        return this.entityRepository.load(this.getInteractionType(), interactionId)
            .then((interaction : Interaction) => {
                interaction.end();
            });
    }

    public getInteractionType() {
        return this.interactionType;
    }
}
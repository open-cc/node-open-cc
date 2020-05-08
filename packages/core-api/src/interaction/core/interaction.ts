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

  public async placeOnHold(interactionId) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.placeOnHold();
  }

  public async routeTo(interactionId, endpoint) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.routeTo(endpoint);
  }

  public async answer(interactionId, answeredByEndpoint) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.answer(answeredByEndpoint);
  }

  public async endInteraction(interactionId) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.end();
  }

  public getInteractionType() {
    return this.interactionType;
  }
}

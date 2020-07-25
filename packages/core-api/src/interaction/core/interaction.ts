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

export class ExternalInteractionInitiatedEvent extends InteractionEvent {
  constructor(public readonly interactionId: string,
              public readonly channel : string,
              public readonly fromAddress : string,
              public readonly toAddress : string) {
    super();
  }
}

export class ExternalInteractionEndedEvent extends InteractionEvent {
  constructor(public readonly interactionId: string) {
    super();
  }
}

export class ExternalInteractionPartyJoinedEvent extends InteractionEvent {
  constructor(public readonly interactionId: string, public readonly endpoint: string) {
    super();
  }
}

export class ExternalInteractionPartyLeftEvent extends InteractionEvent {
  constructor(public readonly interactionId: string, public readonly endpoint: string) {
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

export class InteractionPartyJoinedEvent extends InteractionEvent {
  constructor(public readonly endpoint : string) {
    super();
  }
}

export class InteractionPartyLeftEvent extends InteractionEvent {
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

  public addParty(endpoint) {
    this.dispatch(new InteractionPartyJoinedEvent(endpoint));
  }

  public removeParty(endpoint) {
    this.dispatch(new InteractionPartyLeftEvent(endpoint));
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

  public async addParty(interactionId, endpoint) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.addParty(endpoint);
  }

  public async removeParty(interactionId, endpoint) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.removeParty(endpoint);
  }

  public async endInteraction(interactionId) {
    const interaction : Interaction = await this.entityRepository.load(this.getInteractionType(), interactionId);
    interaction.end();
  }

  public getInteractionType() {
    return this.interactionType;
  }
}

import {
  Entity,
  EntityEvent
} from 'ddd-es-node';
import {WorkersState} from './worker';

export class RoutingStartedEvent extends EntityEvent {
  constructor() {
    super();
  }
}

export class RoutingInProgressEvent extends EntityEvent {
  constructor() {
    super();
  }
}

export class RoutingCompleteEvent extends EntityEvent {
  constructor(readonly interactionId: string, readonly endpoint: string) {
    super();
  }
}

export class RoutingFailedEvent extends EntityEvent {
  constructor() {
    super();
  }
}

export class Route extends Entity {

  constructor(id : string) {
    super(id, (self, event) => {

    });
  }

  routeInteraction(interactionId : string, fromAddress : string, workers : WorkersState) {
    this.dispatch(new RoutingStartedEvent());
    this.dispatch(new RoutingInProgressEvent());
    this.dispatch(new RoutingCompleteEvent(
      interactionId,
      workers[Object.keys(workers)[0]].address));
  }

}

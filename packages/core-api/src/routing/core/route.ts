import {
  Entity,
  EntityEvent
} from 'ddd-es-node';
import {
  WorkerService,
  WorkersState,
  WorkerState,
} from './worker';
import * as debug from 'debug';

const log = debug('route');

interface TimerState {
 [key: string]: NodeJS.Timer[];
}

const timerState : TimerState = {};

export class RoutingStartedEvent extends EntityEvent {
  constructor(public readonly interactionId: string) {
    super();
  }
}

export class RoutingInProgressEvent extends EntityEvent {
  constructor(public readonly interactionId : string) {
    super();
  }
}

export class RoutingCompleteEvent extends EntityEvent {
  constructor(public readonly interactionId : string, public readonly endpoint : string) {
    super();
  }
}

export class RoutingFailedEvent extends EntityEvent {
  constructor(public readonly interactionId : string) {
    super();
  }
}

export class RoutingCancelledEvent extends EntityEvent {
  constructor(public readonly interactionId : string) {
    super();
  }
}

export class Route extends Entity {

  private interactionId : string;

  constructor(id : string, private workerService : WorkerService) {
    super(id, (self : Route, event : EntityEvent) => {
      if (event instanceof RoutingStartedEvent) {
        this.interactionId = event.interactionId;
      }
    });
  }

  routeInteraction(interactionId : string, fromAddress : string,
                   waitInterval : number = 1000,
                   waitTimeout : number = 10000) {
    const timeout : NodeJS.Timer = setTimeout(() => {
        this.dispatch(new RoutingFailedEvent(interactionId));
    }, waitTimeout);
    const timer : NodeJS.Timer = setInterval(async () => {
      this.dispatch(new RoutingInProgressEvent(interactionId));
      const workersState : WorkersState = this.workerService.getWorkersState();
      const worker : WorkerState = Object.keys(workersState)
        .map(id => workersState[id])
        .filter(worker => worker.status !== 'offline' && worker.address && worker.address !== fromAddress)[0];
      log(`Locating worker for ${interactionId} from`, workersState);
      if (worker) {
        log(`Worker located for ${interactionId}`, worker);
        this.clearTimers();
        this.dispatch(new RoutingCompleteEvent(
          interactionId,
          worker.address));
      }
    }, waitInterval);
    timerState[interactionId] = [timeout, timer];
    this.dispatch(new RoutingStartedEvent(interactionId));
  }

  cancel() {
    if (this.interactionId) {
      this.clearTimers();
      this.dispatch(new RoutingCancelledEvent(this.interactionId));
    }
  }

  private clearTimers() {
    if (timerState[this.interactionId]) {
      const timers : NodeJS.Timer[] = timerState[this.interactionId];
      delete timerState[this.interactionId];
      while(timers.length > 0) {
        clearTimeout(timers.shift());
      }
    }
  }

}

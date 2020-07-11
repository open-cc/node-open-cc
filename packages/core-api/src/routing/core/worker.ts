import {
  Entity,
  EntityEvent,
  EntityRepository
} from 'ddd-es-node';

export class UpdateWorkerRegistration {
  public name: string = 'UpdateWorkerRegistration';
  constructor (public readonly registrations: Array<{
    workerId: string,
    address: string,
    routingAddress?: string,
    connected: boolean
  }>) {
  }
}

export class WorkerAddressAssignedEvent extends EntityEvent {
  constructor(public readonly address : string) {
    super();
  }
}

export class WorkerRoutingAddressAssignedEvent extends EntityEvent {
  constructor(public readonly address : string) {
    super();
  }
}

export class WorkerStatusChangedEvent extends EntityEvent {
  constructor(public readonly status : string) {
    super();
  }
}

export class Worker extends Entity {
  private address : string;
  private routingAddress : string;
  private status : string = 'offline';

  constructor(id : string) {
    super(id, (self, event) => {
      if (event instanceof WorkerAddressAssignedEvent) {
        this.address = event.address;
      } else if (event instanceof WorkerRoutingAddressAssignedEvent) {
        this.routingAddress = event.address;
      } else if (event instanceof WorkerStatusChangedEvent) {
        this.status = event.status;
      }
    });
  }

  updateRegistration(address : string, routingAddress : string, connected : boolean) {
    if (address !== this.address) {
      this.dispatch(new WorkerAddressAssignedEvent(address));
    }
    if (!routingAddress && address) {
      routingAddress = address;
    }
    if (routingAddress !== this.routingAddress) {
      this.dispatch(new WorkerRoutingAddressAssignedEvent(routingAddress));
    }
    if (!connected && this.status !== 'offline') {
      this.dispatch(new WorkerStatusChangedEvent('offline'));
    } else if (connected && this.status === 'offline') {
      this.dispatch(new WorkerStatusChangedEvent('online'));
    }
  }
}

export interface WorkerState {
  address? : string;
  routingAddress? : string;
  status? : string;
}

export interface WorkersState {
  [key : string] : WorkerState
}

export class WorkerService {

  private workers : WorkersState = {};

  constructor(private entityRepository : EntityRepository) {
  }

  handleMessage(message : any) {
    switch (message.name) {
      case 'WorkerAddressAssignedEvent': {
        const event : WorkerAddressAssignedEvent = <WorkerAddressAssignedEvent>message;
        this.workers[message.streamId] = this.workers[message.streamId] || {};
        this.workers[message.streamId].address = event.address;
        break;
      }
      case 'WorkerRoutingAddressAssignedEvent': {
        const event : WorkerRoutingAddressAssignedEvent = <WorkerRoutingAddressAssignedEvent>message;
        this.workers[message.streamId] = this.workers[message.streamId] || {};
        this.workers[message.streamId].routingAddress = event.address;
        break;
      }
      case 'WorkerStatusChangedEvent': {
        const event : WorkerStatusChangedEvent = <WorkerStatusChangedEvent>message;
        this.workers[message.streamId] = this.workers[message.streamId] || {};
        this.workers[message.streamId].status = event.status;
        break;
      }
    }
  }

  getWorkersState() : WorkersState {
    return this.workers;
  }

  async updateWorkerRegistration(workerId : string,
                                 address : string,
                                 routingAddress : string,
                                 connection : boolean) {
    const worker : Worker = await this.entityRepository.load(Worker, workerId);
    worker.updateRegistration(address, routingAddress, connection);
  }
}

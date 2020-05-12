import {
  Entity,
  EntityEvent,
  EntityRepository
} from 'ddd-es-node';

export class WorkerAddressAssignedEvent extends EntityEvent {
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
  private status : string = 'offline';

  constructor(id : string) {
    super(id, (self, event) => {
      if (event instanceof WorkerAddressAssignedEvent) {
        this.address = event.address;
      } else if (event instanceof WorkerStatusChangedEvent) {
        this.status = event.status;
      }
    });
  }

  updateRegistration(address : string, connected : boolean) {
    if (address !== this.address) {
      this.dispatch(new WorkerAddressAssignedEvent(address));
    }
    if (!connected) {
      this.dispatch(new WorkerStatusChangedEvent('offline'));
    } else if (this.status === 'offline') {
      this.dispatch(new WorkerStatusChangedEvent('online'));
    }
  }
}

export interface WorkerState {
  address? : string;
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
        this.workers[message.streamId] = {
          ...(this.workers[message.streamId] || {
            address: '',
            status: ''
          }),
          address: event.address
        };
        break;
      }
      case 'WorkerStatusChangedEvent': {
        const event : WorkerStatusChangedEvent = <WorkerStatusChangedEvent>message;
        this.workers[message.streamId] = {
          ...(this.workers[message.streamId] || {
            address: '',
            status: ''
          }),
          status: event.status
        };
        break;
      }
    }
  }

  getWorkersState() : WorkersState {
    return this.workers;
  }

  async updateWorkerRegistration(workerId : string, address : string, connection : boolean) {
    const worker : Worker = await this.entityRepository.load(Worker, workerId);
    worker.updateRegistration(address, connection);
  }
}

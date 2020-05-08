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
  constructor(public readonly connected : boolean) {
    super();
  }
}

export class Worker extends Entity {
  private address : string;
  private connected : boolean;

  constructor(id : string) {
    super(id, (self, event) => {
      if (event instanceof WorkerAddressAssignedEvent) {
        this.address = event.address;
      } else if (event instanceof WorkerStatusChangedEvent) {
        this.connected = event.connected;
      }
    });
  }

  updateRegistration(address : string, connected : boolean) {
    if (address !== this.address) {
      this.dispatch(new WorkerAddressAssignedEvent(address));
    }
    if (connected !== this.connected) {
      this.dispatch(new WorkerStatusChangedEvent(connected));
    }
  }
}

export class WorkerService {
  constructor(private entityRepository : EntityRepository) {
  }

  async updateWorkerRegistration(workerId : string, address : string, connection : boolean) {
    const worker : Worker = await this.entityRepository.load(Worker, workerId);
    worker.updateRegistration(address, connection);
  }
}

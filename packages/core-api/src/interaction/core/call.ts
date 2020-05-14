import {
  Interaction,
  InteractionInitiatedEvent,
  InteractionService
} from './interaction';
import {EntityRepository} from 'ddd-es-node';

export class CallInitiatedEvent extends InteractionInitiatedEvent {
  constructor(public readonly fromAddress : string,
              public readonly toAddress : string) {
    super('voice');
  }
}

export class Call extends Interaction {
  private fromAddress : string;

  constructor(id) {
    super(id, 'voice', (self, event) => {
      if (event instanceof CallInitiatedEvent) {
        this.fromAddress = event.fromAddress;
      }
    });
  }

  public initiate(fromAddress, toAddress) {
    if (!this.fromAddress) {
      this.dispatch(new CallInitiatedEvent(fromAddress, toAddress));
    }
  }
}

export class CallService extends InteractionService {
  constructor(entityRepository : EntityRepository) {
    super(entityRepository, Call);
  }

  async initiateCall(callId, fromAddress, toAddress) {
    const call : Call = await this.entityRepository.load(Call, callId);
    call.initiate(fromAddress, toAddress);
  }
}

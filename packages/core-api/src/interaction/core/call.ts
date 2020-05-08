import {
    Interaction,
    InteractionInitiatedEvent,
    InteractionService
} from './interaction';
import {EntityRepository} from 'ddd-es-node';

export class CallInitiatedEvent extends InteractionInitiatedEvent {
    constructor(public readonly fromPhoneNumber : string,
                public readonly toPhoneNumber : string) {
        super('voice');
    }
}

export class Call extends Interaction {
    private phoneNumber : string;

    constructor(id) {
        super(id, 'voice', (self, event) => {
            if (event instanceof CallInitiatedEvent) {
                this.phoneNumber = event.fromPhoneNumber;
            }
        });
    }

    public initiate(fromPhoneNumber, toPhoneNumber) {
        this.dispatch(new CallInitiatedEvent(fromPhoneNumber, toPhoneNumber));
    }

    public getPhoneNumber() {
        return this.phoneNumber;
    }

}

export class CallService extends InteractionService {
    constructor(entityRepository : EntityRepository) {
        super(entityRepository, Call);
    }

    async initiateCall(callId, fromPhoneNumber, toPhoneNumber) {
      const call : Call = await this.entityRepository.load(Call, callId);
      call.initiate(fromPhoneNumber, toPhoneNumber);
    }
}

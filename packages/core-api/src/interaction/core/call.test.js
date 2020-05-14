import { CallService } from './call';

describe('calls', () => {
    describe('when making a call', () => {
        it('fires a CallInitiatedEvent', () => {
            return withEventStore(es => {
                const callService = new CallService(es.entityRepository);
                return callService.initiateCall('call1234', '+15555555555', '+15555555554')
                    .then(() => {
                        expect(es.eventDispatcher).toHaveDispatched({
                            name: 'CallInitiatedEvent',
                            channel: 'voice',
                            fromAddress: '+15555555555',
                            toAddress: '+15555555554',
                            streamId: 'call1234'
                        });
                    });
            });
        });
    });
});

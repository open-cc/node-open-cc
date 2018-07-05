const calls = require('./call');

describe('calls', () => {
    describe('when making a call', () => {
        it('fires a CallInitiatedEvent', () => {
            return withEventStore(es => {
                const callService = new calls.CallService(es.entityRepository);
                return callService.initiateCall('call1234', '+15555555555', '+15555555554')
                    .then(() => {
                        expect(es.eventDispatcher).toHaveDispatched({
                            name: 'CallInitiatedEvent',
                            channel: 'voice',
                            fromPhoneNumber: '+15555555555',
                            toPhoneNumber: '+15555555554',
                            streamId: 'call1234'
                        });
                    });
            });
        });
    });
});
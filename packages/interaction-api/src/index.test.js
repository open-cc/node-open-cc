describe('interaction api', () => {
    mockAPI(require('./index'), (router, es) => {
        it('initiates calls', () => {
            return router.send('interactions', {
                name: 'started',
                interactionId: '123',
                channel: 'voice',
                fromPhoneNumber: '+15555555555',
                toPhoneNumber: '+15555555554'
            }).then(() => {
                expect(es.eventDispatcher).toHaveDispatched({
                    name: 'CallInitiatedEvent'
                });
            });
        });
        it('ends interactions', () => {
            return router.send('interactions', {
                name: 'ended',
                interactionId: '123'
            }).then(() => {
                expect(es.eventDispatcher).toHaveDispatched({
                    name: 'InteractionEndedEvent'
                });
            });
        });
        it('gets interactions', () => {
            return router.send('interactions', {
                name: 'get'
            }).then((res) => {
                expect(res[0].fromPhoneNumber).toBe('+15555555555');
            })
        });
    });
});
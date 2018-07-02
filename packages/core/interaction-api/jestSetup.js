const BaseEntityRepository = require('ddd-es-node').BaseEntityRepository;
require('ddd-es-node').testMode(true);
const expect = require('expect');

global.withEventStore = callback => {
    const _handlers = [];
    const eventBus = {
        emit(event, streamId) {
            if (streamId) {
                event.streamId = streamId;
            }
            _handlers.forEach(handler => handler(event));
        },
        subscribe(handler) {
            _handlers.push(handler);
        }
    };
    const eventDispatcher = jest.fn((streamId, events) => {
        events.forEach((event) => {
            event.streamId = streamId;
            eventBus.emit(event);
        });
        return Promise.resolve(events);
    });
    const eventStore = {
        replay(id, handler, done) {
            if (done) {
                done();
            }
        },
        replayAll(handler, done) {
            if (done) {
                done();
            }
        }
    };
    expect.extend({
        toHaveDispatched: (target, expectedEvent) => {
            let allEvents = [];
            eventDispatcher.mock.calls.forEach(args => {
                allEvents = allEvents.concat(args[1]);
            });
            const found = allEvents.filter(actualEvent => {
                return Object.keys(expectedEvent).reduce((match, key) => {
                    return actualEvent[key] === expectedEvent[key] && match;
                }, true);
            }).length > 0;
            if (found) {
                return {
                    message: () =>
                        `expected no event to have been dispatched like ${JSON.stringify(expectedEvent)}`,
                    pass: true
                };
            } else {
                return {
                    message: () => `expected an event to have been dispatched like ${JSON.stringify(expectedEvent)}`,
                    pass: false
                };
            }
        }
    });
    const entityRepository = new BaseEntityRepository(eventDispatcher, eventStore);
    return callback({
        eventBus,
        entityRepository,
        eventDispatcher,
        eventStore
    });
};
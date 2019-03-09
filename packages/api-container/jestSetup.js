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
        events = Array.isArray(events) ? events : [events];
        eventDispatcher.events = (eventDispatcher.events || []).concat(events);
        events.forEach((event) => {
            event.streamId = streamId;
            eventBus.emit(event);
        });
        return Promise.resolve(events);
    });
    const eventStore = {
        replay(id, handler) {
          return Promise.resolve();
        },
        replayAll(handler) {
          return Promise.resolve();
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
                        `expected no event to have been dispatched like ${JSON.stringify(expectedEvent)} but received ${JSON.stringify(allEvents)}`,
                    pass: true
                };
            } else {
                return {
                    message: () => `expected an event to have been dispatched like ${JSON.stringify(expectedEvent)} but received ${JSON.stringify(allEvents)}`,
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

global.mockAPI = (api, callback) => {
    const handlers = {};
    const router = {
        register: (stream, handler) => {
            handlers[stream] = handler;
        },
        broadcast: () => {}
    };
    return withEventStore(es => {
        api({
          router,
          eventBus: es.eventBus,
          entityRepository: es.entityRepository,
          log: jest.fn()
        });
        return callback({
            send: (stream, message) => {
                const res = handlers[stream](message);
                return new Promise(resolve => {
                    setTimeout(() => resolve(res), 200);
                });
            }
        }, es);
    });
};

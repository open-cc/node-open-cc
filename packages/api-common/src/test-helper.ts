import {
  Api,
  ApiDeps,
  Stream
} from './interfaces';
import {ApiRegBound, StreamBound} from './server';
import {
  ConnectedMessageRouter,
  HandlerRegistration,
  Message,
  MessageHandler
} from 'meshage';
import {
  BaseEntityRepository,
  EntityEvent,
  EntityRepository,
  EventBus,
  EventDispatcher,
  EventStore,
} from 'ddd-es-node';
import {
  clearMemoryEvents,
  createMemoryEventDispatcher,
  memoryEventStore
} from 'ddd-es-node/runtime/in-memory';
import {LocalEventBus} from 'ddd-es-node/runtime/local-event-bus';

export interface TestApiDeps extends ApiDeps {
  router: ConnectedMessageRouter;
  eventStore: EventStore;
}

class TestApiReg extends ApiRegBound implements TestApiDeps {
  constructor(entityRepository : EntityRepository,
              eventBus : EventBus,
              router : ConnectedMessageRouter,
              public eventStore : EventStore) {
    super(entityRepository, eventBus, router);
  }
  public stream(stream : string) : Stream {
    return new StreamBound(stream, this);
  }
}

export const test = async (api : Api) : Promise<TestApiDeps> => {
  clearMemoryEvents();
  const eventBus : LocalEventBus = new LocalEventBus(memoryEventStore);
  const dispatcher : EventDispatcher = createMemoryEventDispatcher(eventBus);
  const handlers : { [stream : string] : MessageHandler } = {};
  const router : ConnectedMessageRouter = {
    register: function (...registrations: HandlerRegistration[]) : Promise<void> {
      registrations.forEach(registration => {
        handlers[registration.stream] = registration.messageHandler;
      });
      return Promise.resolve();
    },
    send: jest.fn((message : Message) : Promise<{}> => {
      return Promise.resolve(handlers[message.stream](message.data, message));
    }),
    broadcast: jest.fn((message : Message) : Promise<{}> => {
      return Promise.resolve(handlers[message.stream](message.data, message));
    })
  };
  eventBus.subscribe(async (event : EntityEvent) => {
    try {
      await router.broadcast({
        stream: 'events',
        partitionKey: '_',
        data: JSON.parse(JSON.stringify(event))
      });
    } catch (err) {
      // ignore?
    }
  });
  const deps : TestApiReg = new TestApiReg(new BaseEntityRepository(dispatcher, memoryEventStore), eventBus, router, memoryEventStore);
  deps.stream = deps.stream.bind(deps);
  await api(deps);
  await deps.register(router);
  return deps;
};

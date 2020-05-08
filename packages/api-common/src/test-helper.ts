import {
  Api,
  ApiDeps
} from './interfaces';
import {
  ConnectedMessageRouter,
  HandlerRegistration,
  Message,
  MessageHandler
} from 'meshage';
import {
  BaseEntityRepository,
  EntityEvent,
  EventDispatcher,
} from 'ddd-es-node';
import {
  createMemoryEventDispatcher,
  memoryEventStore
} from 'ddd-es-node/runtime/in-memory';
import {LocalEventBus} from 'ddd-es-node/runtime/local-event-bus';
import * as debug from 'debug';

export const test = async (api : Api) : Promise<ApiDeps> => {
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
    //log('broadcasting', event);
    try {
      await router.broadcast({
        stream: 'events',
        partitionKey: event.streamId,
        data: event
      });
      //log('broadcast event', event);
    } catch (err) {
      //log('failed to broadcast event', event, err);
    }
  });
  const deps : ApiDeps = {
    router,
    eventBus,
    eventStore: memoryEventStore,
    entityRepository: new BaseEntityRepository(dispatcher, memoryEventStore),
    log: jest.fn() as any as debug.Debugger
  };
  await api(deps);
  return deps;
};

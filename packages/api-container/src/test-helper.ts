import {
  Api,
  ApiDeps
} from './interfaces';
import {
  ConnectedMessageRouter,
  Message,
  MessageHandler,
  MessageRouterRegistrar
} from 'meshage';
import {
  BaseEntityRepository,
  EventDispatcher,
} from 'ddd-es-node';
import {
  createMemoryEventDispatcher,
  memoryEventStore
} from 'ddd-es-node/dist/src/runtime/in-memory';
import {LocalEventBus} from 'ddd-es-node/dist/src/runtime/local-event-bus';
import * as debug from 'debug';

export const test = (api : Api) : ApiDeps => {
  const eventBus : LocalEventBus = new LocalEventBus(memoryEventStore);
  const dispatcher : EventDispatcher = createMemoryEventDispatcher(new LocalEventBus(memoryEventStore));
  const handlers : { [stream : string] : MessageHandler } = {};
  const router : ConnectedMessageRouter = {
    register: function (stream : string, handler : MessageHandler) : MessageRouterRegistrar {
      handlers[stream] = handler;
      return router;
    },
    send: jest.fn((message : Message) : Promise<{}> => {
      return Promise.resolve(handlers[message.stream](message.data, message));
    }),
    broadcast: jest.fn((message : Message) : Promise<{}> => {
      return Promise.resolve(handlers[message.stream](message.data, message));
    })
  };
  const deps : ApiDeps = {
    router,
    eventBus,
    eventStore: memoryEventStore,
    entityRepository: new BaseEntityRepository(dispatcher, memoryEventStore),
    log: jest.fn() as any as debug.Debugger
  };
  api(deps);
  return deps;
};

import {
  ConnectedMessageRouter,
  GrapevineCluster,
  init,
  Message,
  MessageHandler,
  MessageRouterRegistrar
} from 'meshage';
import {
  BaseEntityRepository,
  EntityEvent,
  EntityRepository,
  entityRepository,
  eventBus,
  EventBus,
  EventDispatcher,
  EventStore,
  eventStore,
} from 'ddd-es-node';
import {
  createMemoryEventDispatcher,
  memoryEventStore
} from 'ddd-es-node/dist/src/runtime/in-memory';
import {LocalEventBus} from 'ddd-es-node/dist/src/runtime/local-event-bus';
import * as path from 'path';
import * as debug from 'debug';

const services : string[] = (process.env.SERVICES || '').split(/,/);
const clusterPort : any = process.env.CLUSTER_PORT || 9742;
const seeds : string[] = (process.env.SEEDS || '').split(/,/);
const apiPort : any = process.env.API_PORT || 8080;

const logName : string = 'api-container';
const log : debug.Debugger = debug(logName);

export interface Api {
  (deps : ApiDeps) : void;
}

export interface ApiDeps {
  router : ConnectedMessageRouter;
  eventBus : EventBus;
  eventStore : EventStore;
  entityRepository : EntityRepository;
  log : debug.Debugger;
}

init(new GrapevineCluster(clusterPort, seeds), apiPort)
  .start(
    (err : Error, router : ConnectedMessageRouter) => {
      services.forEach(service => {
        log(`loading ${service}`);
        const api : Api = <Api>require(service);
        api({
          router,
          eventBus,
          eventStore,
          entityRepository,
          log: debug(`${logName}:${path.basename(service)}`)
        });
      });
      eventBus.subscribe((event : EntityEvent) => {
        router.broadcast({
          stream: 'events',
          partitionKey: event.streamId,
          data: event
        }).then(() => {
          // do nothing
        });
      });
    });

export const test = (api : Api) : ApiDeps => {
  const eventBus : LocalEventBus = new LocalEventBus(memoryEventStore);
  const dispatcher : EventDispatcher = createMemoryEventDispatcher(new LocalEventBus(memoryEventStore));
  const handlers : { [stream : string] : MessageHandler } = {};
  const router : ConnectedMessageRouter = {
    register: function (stream : string, handler : MessageHandler) : MessageRouterRegistrar {
      handlers[stream] = handler;
      return router;
    },
    send(message : Message) : Promise<{}> {
      return Promise.resolve(handlers[message.stream](message.data, message));
    },
    broadcast(message : Message) : Promise<{}> {
      return Promise.resolve(handlers[message.stream](message.data, message));
    }
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

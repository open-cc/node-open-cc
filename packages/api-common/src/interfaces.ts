import {ConnectedMessageRouter} from 'meshage';
import {
  EntityRepository,
  EventBus,
  EventStore
} from 'ddd-es-node';
import * as debug from 'debug';

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

import {ConnectedMessageRouter} from 'meshage';
import {
  EntityRepository,
  EventBus,
  EventStore
} from 'ddd-es-node';

export interface Api {
  (deps : ApiDeps) : void;
}

export interface ApiDeps {
  router : ConnectedMessageRouter;
  eventBus : EventBus;
  eventStore : EventStore;
  entityRepository : EntityRepository;
}

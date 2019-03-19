import {
  ConnectedMessageRouter,
  GrapevineCluster,
  init
} from 'meshage';
import {
  EntityEvent,
  entityRepository,
  eventBus,
  eventStore,
} from 'ddd-es-node';
import * as path from 'path';
import * as debug from 'debug';
import {Api} from './interfaces';

const services : string[] = (process.env.SERVICES || '').split(/,/);
const clusterPort : any = process.env.CLUSTER_PORT || 9742;
const seeds : string[] = (process.env.SEEDS || '').split(/,/);
const apiPort : any = process.env.API_PORT || 8080;

const logName : string = 'api-container';
const log : debug.Debugger = debug(`${logName}:container`);

init(new GrapevineCluster(clusterPort, seeds), apiPort)
  .start(
    (err : Error, router : ConnectedMessageRouter) => {
      eventBus.subscribe((event : EntityEvent) => {
        log('broadcasting', event);
        router.broadcast({
          stream: 'events',
          partitionKey: event.streamId,
          data: event
        }).then(() => {
          log('broadcasted event', event);
        }).catch((err: Error) => {
          log('failed to broadcast event', event, err);
        });
      });
      services.forEach(service => {
        log(`loading ${service}`);
        const required = require(service);
        const api : Api = <Api>(typeof required === 'function' ? required : required.default);
        api({
          router,
          eventBus,
          eventStore,
          entityRepository,
          log: debug(`${logName}:${path.basename(service)}`)
        });
      });
      log(`loaded ${services}`);
    });

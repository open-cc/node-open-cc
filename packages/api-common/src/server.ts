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
import * as proxyquire from 'proxyquire';
import {Api} from './interfaces';

const services : string[] = (process.env.SERVICES || '').split(/,/);
const clusterPort : any = process.env.CLUSTER_PORT || 9742;
const seeds : string[] = (process.env.SEEDS || '').split(/,/);
const apiPort : any = process.env.API_PORT || 8080;

const logName : string = 'api-container';
const log : debug.Debugger = debug(`${logName}:container`);

async function run() {
  const router : ConnectedMessageRouter = await init(new GrapevineCluster(clusterPort, seeds), apiPort)
    .start();
  eventBus.subscribe(async (event : EntityEvent) => {
    log('Broadcasting', event);
    try {
      await router.broadcast({
        stream: 'events',
        partitionKey: '_',
        data: event
      });
      log('Broadcast event', event);
    } catch (err) {
      log('Failed to broadcast event', event, err);
    }
  });
  services.forEach(service => {
    log(`Loading service ${service}`);
    const logNamespace = `${logName}:${path.basename(path.dirname(service))}`;
    const logger = debug(logNamespace);
    const debugProxy = (namespace) => {
      return namespace ? debug(`${logNamespace}:${namespace}`) : logger
    };
    debugProxy['@global'] = true;
    const required = proxyquire(service, {
      debug: debugProxy
    });
    const api : Api = <Api>(typeof required === 'function' ? required : required.default);
    api({
      router,
      eventBus,
      eventStore,
      entityRepository
    });
  });
  log(`Loaded service ${services}`);
}

run()
  .catch(err => log(err));

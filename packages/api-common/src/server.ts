import {
  ConnectedMessageRouter,
  GrapevineCluster,
  HandlerRegistration,
  init
} from 'meshage';
import {httpMessaging} from 'meshage/src/messaging/http';
import {
  defaultEsContext,
  EntityEvent,
  EntityRepository,
  EventBus
} from 'ddd-es-node';
import * as path from 'path';
import * as debug from 'debug';
import * as proxyquire from 'proxyquire';
import {
  Api,
  ApiDeps,
  ConstructorOf,
  MessageHandler,
  MessageHeader,
  Stream
} from './interfaces';
import {envProp} from './util';

const services : string[] = (process.env.SERVICES || '').split(/,/);
const clusterHost : string = envProp(() => process.env.CLUSTER_HOST);
const clusterPort : any = process.env.CLUSTER_PORT || 9742;
const clusterNetworks : string[] = process.env.CLUSTER_NETWORKS ? process.env.CLUSTER_NETWORKS.split(',') : ['all'];
const seeds : string[] = (process.env.SEEDS || '').split(/,/);
const apiPort : any = process.env.API_PORT || 8080;

const logName : string = 'api-container';
const log : debug.Debugger = debug(`${logName}:container`);

export class StreamBound implements Stream {
  constructor(private stream : string, private apiReg : ApiRegBound) {
    if (!apiReg) {
      throw new Error(`No apireg for ${stream}`);
    }
  }

  on<T>(name : (string | ConstructorOf<T>), handler : MessageHandler<T>) : Stream {
    if (!this.apiReg) {
      throw new Error(`No apireg for ${this.stream}`);
    }
    const strName: string = typeof name === 'string' ? name : name.name;
    this.apiReg.handlers[this.stream] = this.apiReg.handlers[this.stream] || {};
    this.apiReg.handlers[this.stream][strName] = handler;
    return this;
  }

  async broadcast<T>(message : any): Promise<T[]> {
    return (await this.apiReg.router.broadcast({
      stream: this.stream,
      partitionKey: '_',
      data: message
    }) as any as T[]);
  }

  async send<T>(partitionKey: string, message : any): Promise<T> {
    return (await this.apiReg.router.send({
      stream: this.stream,
      partitionKey: partitionKey,
      data: message
    }) as any as T);
  }
}

export class ApiRegBound implements ApiDeps {
  public handlers : { [stream : string] : { [name : string] : MessageHandler<any> } } = {};
  constructor(public entityRepository : EntityRepository, public eventBus : EventBus, public router : ConnectedMessageRouter) {
  }
  public stream(stream : string) : Stream {
    return new StreamBound(stream, this);
  }
  public async register(router: ConnectedMessageRouter) {
    const self : ApiRegBound = this;
    const registrations : HandlerRegistration[] = Object.keys(this.handlers).map((stream : string) : HandlerRegistration => {
      return {
        stream,
        async messageHandler(data : any, header : MessageHeader) {
          await self.invokeHandler(stream, 'before', data, header);
          let res;
          try {
            res = await self.invokeHandler(stream, data.name, data, header);
          } finally {
            await self.invokeHandler(stream, 'after', data, header);
          }
          return res;
        }
      }
    });
    log(`Registered handlers: [${registrations.map((reg) => reg.stream).join(', ')}]`)
    await router.register(...registrations);
  }
  private async invokeHandler(stream : string, name: string, data : any, header : MessageHeader) {
    const handler : MessageHandler<any> = this.handlers[stream][name];
    if (handler) {
      return await handler(data, header);
    } else {
      return {message: `UNKNOWN`};
    }
  }
}

async function run() {
  const router : ConnectedMessageRouter = await init(new GrapevineCluster({
    address: clusterHost,
    bindAddress: '0.0.0.0',
    port: clusterPort,
    seeds,
    networks: clusterNetworks
  }), httpMessaging(`0.0.0.0:${apiPort}`))
    .start();
  const { eventBus, entityRepository } = defaultEsContext;
  eventBus.subscribe(async (event : EntityEvent, isReplaying : boolean) => {
    if (!isReplaying) {
      log('Broadcasting', event);
      try {
        await router.broadcast({
          stream: 'events',
          partitionKey: '_',
          data: event
        });
      } catch (err) {
        log('Failed to broadcast event', event, err);
      }
    }
  }, {replay: true});
  for (const service of services) {
    log(`Registering service ${service}`);
    const logNamespace = `${logName}:${path.basename(path.dirname(service))}`;
    const logger = debug(logNamespace);
    const debugProxy = (namespace) => {
      return namespace ? debug(`${logNamespace}:${namespace}`) : logger
    };
    debugProxy['@global'] = true;
    const required = proxyquire(service, {
      debug: debugProxy
    });
    const apiReg : ApiRegBound = new ApiRegBound(entityRepository, eventBus, router);
    apiReg.stream = apiReg.stream.bind(apiReg);
    const api : Api = <Api>(typeof required === 'function' ? required : required.default);
    await api(apiReg);
    await apiReg.register(router);
    log(`Registration complete ${service}`);
  }
}

run()
  .catch(err => log(err));

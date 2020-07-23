import {
  Client,
  connect,
  Msg,
  MsgCallback,
  Subscription,
  SubscriptionOptions
} from 'ts-nats';
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
import {NatsError} from 'ts-nats/lib/error';
import * as express from 'express';
import * as bodyParser from 'body-parser';

const services : string[] = (process.env.SERVICES || '').split(/,[ ]+/);
const logName : string = 'api-container';
const log : debug.Debugger = debug(`${logName}:container`);
const shutdownHandlers : (() => Promise<void>)[] = [];

export class StreamBound implements Stream {
  constructor(private stream : string, private apiReg : ApiRegBound) {
    if (!apiReg) {
      throw new Error(`No apireg for ${stream}`);
    }
  }

  public on<T>(name : (string | ConstructorOf<T>), handler : MessageHandler<T>) : Stream {
    if (!this.apiReg) {
      throw new Error(`No apireg for ${this.stream}`);
    }
    const strName : string = typeof name === 'string' ? name : name.name;
    this.apiReg.handlers[this.stream] = this.apiReg.handlers[this.stream] || {};
    this.apiReg.handlers[this.stream][strName] = handler;
    setTimeout(async () => {
      await this.apiReg.register();
    }, 1);
    return this;
  }

  public async awaitRegistration() {
    while (!this.apiReg.subscriptions[`${this.stream}-broadcast`]) {
      await new Promise((resolve) => setTimeout(() => resolve(), 100));
    }
  }

  public async broadcast<T>(message : any) : Promise<T[]> {
    message.stream = this.stream;
    const msg : Msg = await this.apiReg.natsConnection.request(`${this.stream}-broadcast`, 30000, JSON.stringify(message));
    try {
      return (msg.data && msg.data.length > 0 ? JSON.parse(msg.data) : null) as any as T[];
    } catch (err) {
      log(`Error parsing data: ${msg.data}`, msg, err);
      throw err;
    }
  }

  public async send<T>(partitionKey : string, message : any) : Promise<T> {
    message.stream = this.stream;
    message.partitionKey = partitionKey;
    const msg : Msg = await this.apiReg.natsConnection.request(`${this.stream}-queue-group`, 30000, JSON.stringify(message));
    try {
      return (msg.data && msg.data.length > 0 ? JSON.parse(msg.data) : null) as any as T;
    } catch (err) {
      log(`Error parsing data: ${msg.data}`, msg, err);
      throw err;
    }
  }

  public async unbind() {
    await this.apiReg.unregister(this.stream);
  }
}

export class ApiRegBound implements ApiDeps {
  public readonly handlers : { [stream : string] : { [name : string] : MessageHandler<any> } } = {};
  public readonly registeredStreams : string[] = [];
  public readonly subscriptions : { [stream : string] : Subscription } = {};
  private readonly pendingRegistrations : Promise<void>[] = [];

  constructor(public readonly entityRepository : EntityRepository,
              public readonly eventBus : EventBus,
              public readonly natsConnection : Client) {
  }

  public stream(stream : string) : Stream {
    return new StreamBound(stream, this);
  }

  public async register() {
    this.pendingRegistrations.push((async () => {
      const handlerStreams : string[] = Object
        .keys(this.handlers)
        .filter(stream => !this.registeredStreams.includes(stream));
      for (const stream of handlerStreams) {
        this.registeredStreams.push(stream);
        const self : ApiRegBound = this;
        const msgCallback : MsgCallback = async (err : NatsError | null, msg : Msg) => {
          const data = JSON.parse(msg.data);
          const header : MessageHeader = {
            stream: msg.subject,
            partitionKey: data.partitionKey
          };
          if (err) {
            throw err;
          } else {
            try {
              await self.invokeHandler(stream, 'before', data, header);
              try {
                const res = await self.invokeHandler(stream, data.name, data, header);
                if (msg.reply) {
                  this.natsConnection.publish(msg.reply, JSON.stringify(res));
                }
              } finally {
                await self.invokeHandler(stream, 'after', data, header);
              }
            } catch (err) {
              log('Error invoking handler', err);
              if (msg.reply) {
                this.natsConnection.publish(msg.reply, JSON.stringify({
                  type: 'error',
                  error: err.message
                }));
              }
            }
          }
        };
        await this.makeSubscription(`${stream}-broadcast`, msgCallback);
        await this.makeSubscription(`${stream}-queue-group`, msgCallback, {queue: `${stream}-qg`});
      }
      if (handlerStreams.length > 0) {
        log(`Registered streams: [${handlerStreams.join(', ')}]`);
      }
    })());
  }

  private async makeSubscription(name : string, msgCallback : MsgCallback, opts? : SubscriptionOptions) {
    this.subscriptions[name] = await this.natsConnection.subscribe(name, msgCallback, opts);
  }

  public async unregister(stream : string) {
    for (const subject of [`${stream}-broadcast`, `${stream}-queue-group`]) {
      if (this.subscriptions[subject]
        && !this.subscriptions[subject].isDraining()
        && !this.subscriptions[subject].isCancelled()) {
        log(`Draining stream ${subject}`);
        await this.subscriptions[subject].drain();
        delete this.handlers[stream];
        const idx = this.registeredStreams.indexOf(stream);
        if (idx > -1) {
          this.registeredStreams.splice(idx, 1);
        }
        log(`Unregistered stream ${subject}`);
      }
    }
  }

  public async awaitRegistrations() {
    await Promise.all(this.pendingRegistrations);
  }

  public async shutdown() : Promise<void> {
    for (const handler of shutdownHandlers) {
      try {
        log('Closing nats connection');
        await this.natsConnection.drain();
      } catch (err) {
        log('Failed to close nats connection');
      }
      await handler();
    }
  }

  private async invokeHandler(stream : string, name : string, data : any, header : MessageHeader) {
    const handler : MessageHandler<any> = this.handlers[stream][name] || this.handlers[stream]['*'];
    if (handler) {
      return await handler(data, header);
    } else {
      return {message: `UNKNOWN`};
    }
  }
}

export interface ApiRegConfigurator {
  (apiReg : ApiRegBound) : ApiRegBound;
}

export async function configure(apis : Api[],
                                entityRepository : EntityRepository,
                                eventBus : EventBus,
                                natsConnection : Client,
                                httpPort : number,
                                apiRegConfigurator? : ApiRegConfigurator) : Promise<ApiRegBound[]> {
  eventBus.subscribe(async (event : EntityEvent) => {
    log('Broadcasting', event);
    try {
      natsConnection
        .publish('events-broadcast', JSON.stringify(event));
    } catch (err) {
      log('Failed to broadcast event', event, err);
    }
  }, {replay: false});
  const apiRegs : ApiRegBound[] = [];
  for (const api of apis) {
    let apiReg : ApiRegBound = new ApiRegBound(entityRepository, eventBus, natsConnection);
    apiReg.stream = apiReg.stream.bind(apiReg);
    if (apiRegConfigurator) {
      apiReg = apiRegConfigurator(apiReg);
    }
    await api(apiReg);
    await apiReg.awaitRegistrations();
    apiRegs.push(apiReg);
  }
  if (apiRegs.length > 0) {
    const app = express();
    app.use(bodyParser.json());
    app.post('/api/broadcast/:streamName', async (req, res) => {
      const {streamName} = req.params;
      try {
        const results = await apiRegs[0]
          .stream(streamName)
          .broadcast(req.body);
        res.send(results);
      } catch (err) {
        res.send(500, {error: err.message});
      }
    });
    app.post('/api/:streamName/:partitionKey', async (req, res) => {
      const {streamName, partitionKey} = req.params;
      try {
        const result = await apiRegs[0]
          .stream(streamName)
          .send(partitionKey, req.body);
        res.send(result);
      } catch (err) {
        res.send(500, {error: err.message});
      }
    });
    await new Promise((resolve) => {
      const server = app.listen(httpPort, () => {
        log(`Started http listener on ${httpPort}`);
        resolve();
      });
      shutdownHandlers.push(async () => {
        try {
          await new Promise((resolve) => {
            server.close(() => {
              log(`Closed http listener on ${httpPort}`);
              resolve();
            });
          });
        } catch (err) {
          // ignore
        }
      });
    });
  }
  return apiRegs;
}

async function getNatsConnection(attempts : number = 1000) {
  let natsConnection;
  while (!natsConnection && attempts > 0) {
    try {
      const servers = (process.env.NATS_SERVERS || '').split(/,[ ]+/);
      log(`Connecting to nats servers ${servers.join(', ')}`);
      natsConnection = await connect({servers})
    } catch (err) {
      attempts--;
      log(err);
      if (attempts === 0) {
        throw err;
      } else {
        await new Promise((resolve) => setTimeout(() => resolve(), 500));
      }
    }
  }
  return natsConnection;
}

export function run() {
  async function doRun() {
    const natsConnection = await getNatsConnection();
    const {eventBus, entityRepository} = defaultEsContext;
    const apis : Api[] = services.map((service) => {
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
      return <Api>(typeof required === 'function' ? required : required.default);
    });
    await configure(apis, entityRepository, eventBus, natsConnection, 8080);
    log(`Registration complete ${services.join(', ')}`);
  }

  doRun()
    .catch(err => log(err));
}

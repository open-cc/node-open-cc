import {
  Client,
  connect,
  Msg
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

  on<T>(name : (string | ConstructorOf<T>), handler : MessageHandler<T>) : Stream {
    if (!this.apiReg) {
      throw new Error(`No apireg for ${this.stream}`);
    }
    const strName : string = typeof name === 'string' ? name : name.name;
    this.apiReg.handlers[this.stream] = this.apiReg.handlers[this.stream] || {};
    this.apiReg.handlers[this.stream][strName] = handler;
    return this;
  }

  async broadcast<T>(message : any) : Promise<T[]> {
    message.stream = this.stream;
    const msg : Msg = await this.apiReg.natsConnection.request(this.stream, 30000, JSON.stringify(message));
    try {
      return (msg.data && msg.data.length > 0 ? JSON.parse(msg.data) : null) as any as T[];
    } catch (err) {
      log(`Error parsing data: ${msg.data}`, msg, err);
      throw err;
    }
  }

  async send<T>(partitionKey : string, message : any) : Promise<T> {
    message.stream = this.stream;
    message.partitionKey = partitionKey;
    const msg : Msg = await this.apiReg.natsConnection.request(this.stream, 30000, JSON.stringify(message));
    try {
      return (msg.data && msg.data.length > 0 ? JSON.parse(msg.data) : null) as any as T;
    } catch (err) {
      log(`Error parsing data: ${msg.data}`, msg, err);
      throw err;
    }
  }
}

export class ApiRegBound implements ApiDeps {
  public handlers : { [stream : string] : { [name : string] : MessageHandler<any> } } = {};

  constructor(public entityRepository : EntityRepository,
              public eventBus : EventBus,
              public natsConnection : Client) {
  }

  public stream(stream : string) : Stream {
    return new StreamBound(stream, this);
  }

  public async register() {
    const self : ApiRegBound = this;
    const handlerStreams : string[] = Object.keys(this.handlers);
    for (const stream of handlerStreams) {
      await this.natsConnection.subscribe(stream, async (err : NatsError | null, msg : Msg) => {
        const data = JSON.parse(msg.data);
        const header : MessageHeader = {
          stream: msg.subject,
          partitionKey: data.partitionKey
        };
        if (err) {
          throw err;
        } else {
          await self.invokeHandler(stream, 'before', data, header);
          try {
            const res = await self.invokeHandler(stream, data.name, data, header);
            if (msg.reply) {
              this.natsConnection.publish(msg.reply, JSON.stringify(res));
            }
          } finally {
            await self.invokeHandler(stream, 'after', data, header);
          }
        }
      });
    }
    log(`Registered handlers: [${handlerStreams.join(', ')}]`);
  }

  public async shutdown() : Promise<void> {
    for (const handler of shutdownHandlers) {
      await handler();
    }
  }

  private async invokeHandler(stream : string, name : string, data : any, header : MessageHeader) {
    const handler : MessageHandler<any> = this.handlers[stream][name];
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
        .publish('events', JSON.stringify(event));
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
    await apiReg.register();
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

async function getNatsConnection(attempts: number = 1000) {
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

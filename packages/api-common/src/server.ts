import {
  defaultEsContext,
  EntityEvent,
  EntityRepository,
  EventBus
} from 'ddd-es-node';
import {
  Mesh,
  mesh,
  nats,
  http
} from 'meshage';
import * as path from 'path';
import * as debug from 'debug';
import * as proxyquire from 'proxyquire';
import {
  Api,
  ApiDeps,
  Subject
} from './interfaces';

const services : string[] = (process.env.SERVICES || '').split(/,[ ]+/);
const logName : string = 'api-container';
const log : debug.Debugger = debug(`${logName}:container`);

export class ApiRegBound implements ApiDeps {
  public readonly pendingSubjectRegistrations : string[] = [];

  constructor(public readonly entityRepository : EntityRepository,
              public readonly eventBus : EventBus,
              public readonly mesh : Mesh) {
  }

  public subject(subject : string) : Subject {
    this.pendingSubjectRegistrations.push(subject);
    return this.mesh.subject(subject);
  }

  public async register() {
    while (this.pendingSubjectRegistrations.length > 0) {
      await this.mesh.subject(this.pendingSubjectRegistrations.shift()).awaitRegistration();
    }
  }

  public async unregister(stream : string) {
    await this.mesh.subject(stream).unbind();
  }

  public async awaitRegistrations() {
    return this.register();
  }

  public async shutdown() : Promise<void> {
    return this.mesh.shutdown();
  }

}

export interface ApiRegConfigurator {
  (apiReg : ApiRegBound) : ApiRegBound;
}

export async function configure(apis : Api[],
                                entityRepository : EntityRepository,
                                eventBus : EventBus,
                                mesh : Mesh,
                                apiRegConfigurator? : ApiRegConfigurator) : Promise<ApiRegBound[]> {
  const eventBusLog = log.extend('debug');
  eventBus.subscribe(async (event : EntityEvent) => {
    const eventWithMessageId = {...event, m_uuid: event.uuid};
    eventBusLog('Broadcasting %o', eventWithMessageId);
    try {
      await mesh.subject('events')
        .broadcast(eventWithMessageId, { wait: false });
    } catch (err) {
      eventBusLog('Failed to broadcast event - %o', eventWithMessageId, err);
    }
  }, {replay: false});
  const apiRegs : ApiRegBound[] = [];
  for (const api of apis) {
    let apiReg : ApiRegBound = new ApiRegBound(entityRepository, eventBus, mesh);
    apiReg.subject = apiReg.subject.bind(apiReg);
    if (apiRegConfigurator) {
      apiReg = apiRegConfigurator(apiReg);
    }
    await api(apiReg);
    await apiReg.awaitRegistrations();
    apiRegs.push(apiReg);
  }
  return apiRegs;
}

export function run() {
  async function doRun() {
    const servers = (process.env.NATS_SERVERS || '').split(/,[ ]+/);
    const monitorUrl = process.env.NATS_MONITOR_URL;
    const meshInst : Mesh = mesh(http(nats({
      servers,
      monitorUrl
    }), parseInt(process.env.HTTP_PORT || '8080', 10)));
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
    await configure(apis, entityRepository, eventBus, meshInst);
    log(`Registration complete ${services.join(', ')}`);
  }

  doRun()
    .catch(err => log(err));
}

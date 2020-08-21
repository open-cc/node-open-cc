import {
  Api,
  ApiDeps,
  Subject
} from './interfaces';
import {
  ApiRegBound,
  configure,
} from './server';
import {
  Mesh,
  mesh,
  http
} from 'meshage';
import {
  BaseEntityRepository,
  EntityEvent,
  EntityRepository,
  EsContext,
  EventBus,
  EventDispatcher,
  EventStore,
  MemoryEventStore
} from 'ddd-es-node';
import {
  fake
} from 'meshage/src/backends/fake-backend';
import getPortAsync from 'get-port';

const testPorts = {};

export interface TestApiDeps extends ApiDeps {
  mesh : Mesh;
  eventStore : EventStore;

  eventFired(object : any) : void;
}

class TestApiReg extends ApiRegBound implements TestApiDeps {
  constructor(entityRepository : EntityRepository,
              eventBus : EventBus,
              mesh : Mesh,
              public readonly eventStore : EventStore,
              public readonly cleanup? : () => Promise<void>) {
    super(entityRepository, eventBus, mesh);
  }

  public eventFired(object : any) : void {
  }

  public async shutdown() {
    await super.shutdown();
    if (this.cleanup) {
      await this.cleanup();
    }
  }
}

export function getPort(name: string) {
  return testPorts[process.env.JEST_WORKER_ID][name];
}

async function initPort(name: string) {
  testPorts[process.env.JEST_WORKER_ID] = testPorts[process.env.JEST_WORKER_ID] || {};
  testPorts[process.env.JEST_WORKER_ID][name] = await getPortAsync();
}

export const test = async (api : Api) : Promise<TestApiDeps> => {
  const memoryEventStore : MemoryEventStore = new MemoryEventStore();
  const esContext : EsContext = new EsContext(memoryEventStore);
  const eventBus : EventBus = esContext.eventBus;
  const dispatcher : EventDispatcher = esContext.eventDispatcher;
  const testApiRegRefs : TestApiReg[] = [];

  await initPort('http');

  eventBus.subscribe(async (event : EntityEvent) => {
    for (const testApiRef of testApiRegRefs) {
      testApiRef.eventFired(event.name);
      testApiRef.eventFired(event);
    }
  }, {replay: false});

  try {
    const mockStreams : { [key : string] : Subject } = {};
    const natsMesh : Mesh = mesh(http(fake(), getPort('http')));
    const entityRepository = new BaseEntityRepository(dispatcher, memoryEventStore);
    const testApiReg : TestApiReg = (await configure([api],
      entityRepository,
      eventBus,
      natsMesh,
      (apiReg) => {
        const testApiReg : TestApiReg = new TestApiReg(
          entityRepository,
          eventBus,
          natsMesh,
          memoryEventStore);
        testApiReg.eventFired = jest.fn();
        testApiRegRefs.push(testApiReg);
        // @ts-ignore
        if (process.env.JEST_WORKER_ID) {
          testApiReg.subject = jest.fn((...args) => {
            if (!mockStreams[args[0]]) {
              const actualStream = apiReg.subject(args[0]);
              // @ts-ignore
              actualStream.send = jest.spyOn(actualStream, 'send');
              // @ts-ignore
              actualStream.broadcast = jest.spyOn(actualStream, 'broadcast');
              mockStreams[args[0]] = actualStream;
            }
            return mockStreams[args[0]];
          })
          return testApiReg;
        }
        return apiReg;
      }))[0] as any as TestApiReg;
    // Give more time for registering streams
    await new Promise((resolve) => setTimeout(() => resolve(), 1000));
    await testApiReg.awaitRegistrations();
    return testApiReg;
  } catch (err) {
    console.error(err);
    return { shutdown: () => Promise.resolve() } as any;
  }
};

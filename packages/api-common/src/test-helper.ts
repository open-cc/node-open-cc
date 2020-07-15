import {
  Api,
  ApiDeps,
  Stream
} from './interfaces';
import {
  ApiRegBound,
  configure,
  StreamBound
} from './server';
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
  Client,
  connect
} from 'ts-nats';
import {Docker} from 'node-docker-api';
import {execSync} from 'child_process';

const docker = new Docker({socketPath: '/var/run/docker.sock'});

export interface TestApiDeps extends ApiDeps {
  natsConnection : Client;
  eventStore : EventStore;
  eventFired(object : any) : void;
}

class TestApiReg extends ApiRegBound implements TestApiDeps {
  constructor(entityRepository : EntityRepository,
              eventBus : EventBus,
              natsConnection : Client,
              public readonly eventStore : EventStore,
              public readonly cleanup : () => Promise<void>) {
    super(entityRepository, eventBus, natsConnection);
  }

  public stream(stream : string) : Stream {
    return new StreamBound(stream, this);
  }

  public eventFired(object : any) : void {
  }

  public async shutdown() {
    await super.shutdown();
    await this.cleanup();
  }
}

export function isContainerRunning(name : string) {
  const result = execSync(`bash -c "if docker ps | grep -q ${name}; then echo true; else echo false; fi"`, {encoding: 'utf8'}).trim();
  return result === 'true';
}

export function stopContainers(name : string) {
  execSync(`bash -c "docker ps | grep ${name} | awk '{print \\$1}' | xargs -I{} docker stop {}"`)
  execSync(`bash -c "docker ps -a | grep ${name} | awk '{print \\$1}' | xargs -I{} docker rm {}"`)
}

export const test = async (api : Api) : Promise<TestApiDeps> => {
  const memoryEventStore : MemoryEventStore = new MemoryEventStore();
  const esContext : EsContext = new EsContext(memoryEventStore);
  const eventBus : EventBus = esContext.eventBus;
  const dispatcher : EventDispatcher = esContext.eventDispatcher;
  const testApiRegRefs : TestApiReg[] = [];
  const testId = process.env.JEST_WORKER_ID || 0;
  const natsContainerName = `nats-test-instance-${testId}`;

  eventBus.subscribe(async (event : EntityEvent) => {
    for (const testApiRef of testApiRegRefs) {
      testApiRef.eventFired(event.name);
      testApiRef.eventFired(event);
    }
  }, {replay: false});

  const promisifyStream = (stream) => new Promise((resolve, reject) => {
    stream.on('data', (d) => console.log(d.toString()))
    stream.on('end', resolve)
    stream.on('error', reject)
  });

  let containerCleanup;
  try {
    process.on('SIGINT', () => {
      stopContainers(natsContainerName);
      process.exit(0);
    });
    if (!isContainerRunning(natsContainerName)) {
      await docker.image.create({}, {fromImage: 'nats', tag: 'alpine3.11'})
        .then(stream => promisifyStream(stream))
        .then(() => docker.image.get('nats:alpine3.11').status());
      const natsContainer = await docker.container.create({
        Image: 'nats:alpine3.11',
        name: natsContainerName,
        PortBindings: {
          "4222/tcp": [{"HostPort": `422${testId}`}]
        }
      });
      await natsContainer.start();
      natsContainer.logs({
        stdout: true,
        stderr: true
      }).then(stream => promisifyStream(stream))
    }
    containerCleanup = async () => {
      stopContainers(natsContainerName);
    }
  } catch (err) {
    console.log('Failed to start nats', err);
    stopContainers(natsContainerName);
  }

  try {
    const mockStreams : { [key : string] : Stream } = {};
    const natsConnection = await connect({servers: [`nats://localhost:422${testId}`]})
    const entityRepository = new BaseEntityRepository(dispatcher, memoryEventStore);
    return (await configure([api],
      entityRepository,
      eventBus,
      natsConnection,
      parseInt(`899${testId}`, 10),
      (apiReg) => {
        const testApiReg : TestApiReg = new TestApiReg(
          entityRepository,
          eventBus,
          natsConnection,
          memoryEventStore,
          containerCleanup);
        testApiReg.eventFired = jest.fn();
        testApiRegRefs.push(testApiReg);
        apiReg.stream = (stream) => new StreamBound(stream, testApiReg);
        // @ts-ignore
        if (process.env.JEST_WORKER_ID) {
          testApiReg.stream = jest.fn((...args) => {
            if (!mockStreams[args[0]]) {
              const actualStream = apiReg.stream(args[0]);
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
  } catch (err) {
    await containerCleanup();
    console.error(err);
    throw err;
  }
};

import api, {workerService} from './';
import {
  ApiDeps,
  test
} from '@open-cc/api-common';
import {ConnectedMessageRouter} from 'meshage';

describe('router-api', () => {
  let router : ConnectedMessageRouter;
  beforeEach(async () => {
    const apiDeps : ApiDeps = await test(api);
    router = apiDeps.router;
  });
  it('tracks worker state', async () => {
    await router.send({
      stream: 'workers',
      partitionKey: 'thePartitionKey',
      data: {
        name: 'UpdateWorkerRegistration',
        workerId: 'worker1002',
        address: 'SIP/1002',
        connected: true
      }
    });
    await wait(1);
    expect(workerService.getWorkersState()['worker1002']).toBeDefined();
    expect(workerService.getWorkersState()['worker1002'].address).toBe('SIP/1002');
    expect(workerService.getWorkersState()['worker1002'].status).toBe('online');
    await router.send({
      stream: 'workers',
      partitionKey: 'thePartitionKey',
      data: {
        name: 'UpdateWorkerRegistration',
        workerId: 'worker1002',
        address: 'SIP/1002',
        connected: false
      }
    });
    await wait(1);
    expect(workerService.getWorkersState()['worker1002'].status).toBe('offline');
  });
  it('routes', async () => {
    setTimeout(async () => {
      await router.send({
        stream: 'workers',
        partitionKey: 'thePartitionKey',
        data: {
          name: 'UpdateWorkerRegistration',
          workerId: 'worker1002',
          address: 'SIP/1002',
          connected: true
        }
      });
    }, 100);
    await wait(21);
    await router.send({
      stream: 'events',
      partitionKey: 'thePartitionKey',
      data: {
        name: 'CallInitiatedEvent',
        streamId: '123',
        fromAddress: 'SIP/1001',
        waitInterval: 90,
        waitTimeout: 1000000
      }
    });
    await wait(101);
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'RoutingStartedEvent',
        streamId: '123'
      })
    });
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'RoutingInProgressEvent',
        streamId: '123'
      })
    });
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'RoutingCompleteEvent',
        endpoint: 'SIP/1002'
      })
    });
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

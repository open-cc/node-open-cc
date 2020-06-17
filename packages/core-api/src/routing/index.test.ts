import api, {workerService} from './';
import {
  test,
  TestApiDeps
} from '@open-cc/api-common';

describe('router-api', () => {
  let apiDeps : TestApiDeps;
  beforeEach(async () => {
    apiDeps = await test(api);
  });
  it('tracks worker state', async () => {
    await apiDeps.router.send({
      stream: 'workers',
      partitionKey: 'thePartitionKey',
      data: {
        name: 'UpdateWorkerRegistration',
        registrations: [{
          workerId: 'worker1002',
          address: 'SIP/1002',
          connected: true
        }]
      }
    });
    await wait(1);
    expect(workerService.getWorkersState()['worker1002']).toBeDefined();
    expect(workerService.getWorkersState()['worker1002'].address).toBe('SIP/1002');
    expect(workerService.getWorkersState()['worker1002'].status).toBe('online');
    await apiDeps.router.send({
      stream: 'workers',
      partitionKey: 'thePartitionKey',
      data: {
        name: 'UpdateWorkerRegistration',
        registrations: [{
          workerId: 'worker1002',
          address: 'SIP/1002',
          connected: false
        }]
      }
    });
    await wait(1);
    expect(workerService.getWorkersState()['worker1002'].status).toBe('offline');
  });
  it('routes', async () => {
    setTimeout(async () => {
      await apiDeps.router.send({
        stream: 'workers',
        partitionKey: 'thePartitionKey',
        data: {
          name: 'UpdateWorkerRegistration',
          registrations: [{
            workerId: 'worker1002',
            address: 'SIP/1002',
            connected: true
          }]
        }
      });
    }, 100);
    await wait(21);
    await apiDeps.router.send({
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
    expect(apiDeps.router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'RoutingStartedEvent',
        streamId: '123'
      })
    });
    expect(apiDeps.router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'RoutingInProgressEvent',
        streamId: '123'
      })
    });
    expect(apiDeps.router.broadcast).toHaveBeenCalledWith({
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

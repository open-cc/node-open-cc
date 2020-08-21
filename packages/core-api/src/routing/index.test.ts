import api from './';
import {
  test,
  TestApiDeps
} from '@open-cc/api-common';

describe('router-api', () => {
  let apiDeps : TestApiDeps;
  beforeEach(async () => {
    apiDeps = await test(api);
  }, 60000);
  afterEach(async () => await apiDeps.shutdown());
  describe('with multiple router-apis', () => {
    let apiDeps2 : TestApiDeps;
    beforeEach(async () => {
      apiDeps2 = await test(api);
    }, 60000);
    afterEach(async () => await apiDeps2.shutdown());
    it('tracks worker state on multiple instances', async () => {
      await apiDeps.subject('workers').send('thePartitionKey',{
        name: 'UpdateWorkerRegistration',
        registrations: [{
          workerId: 'worker1003',
          address: 'SIP/1003',
          connected: true
        }]
      });
      let workers : any[] = await apiDeps.subject('workers').broadcast({name: 'get_workers'});
      console.log(workers);
      expect(workers.length).toBe(2);
      expect(workers[0].workers).toBeDefined();
      expect(workers[0].workers.worker1003.address).toBe('SIP/1003');
    });
  });
  it('tracks worker state with single instance', async () => {
    await apiDeps.subject('workers').send('thePartitionKey', {
      name: 'UpdateWorkerRegistration',
      registrations: [{
        workerId: 'worker1002',
        address: 'SIP/1002',
        connected: true
      }]
    });
    await wait(1);
    let {workers} = await apiDeps.subject('workers').send('thePartitionKey', {name: 'get_workers'});
    expect(workers['worker1002']).toBeDefined();
    expect(workers['worker1002'].address).toBe('SIP/1002');
    expect(workers['worker1002'].status).toBe('online');
    await apiDeps.subject('workers').send('thePartitionKey', {
      name: 'UpdateWorkerRegistration',
      registrations: [{
        workerId: 'worker1002',
        address: 'SIP/1002',
        connected: false
      }]
    });
    await wait(1);
    workers = ((await apiDeps.subject('workers').send('thePartitionKey', {name: 'get_workers'})) as any).workers;
    expect(workers['worker1002'].status).toBe('offline');
  });
  it('routes', async () => {
    setTimeout(async () => {
      await apiDeps.subject('workers').send('thePartitionKey', {
        name: 'UpdateWorkerRegistration',
        registrations: [{
          workerId: 'worker1002',
          address: 'SIP/1002',
          connected: true
        }]
      });
    }, 100);
    await wait(21);
    await apiDeps
      .subject('routing')
      .send('thePartitionKey', {
        name: 'route',
        streamId: '123',
        fromAddress: 'SIP/1001',
        waitInterval: 90,
        waitTimeout: 1000000
      });
    await wait(101);
    expect(apiDeps.eventFired)
      .toHaveBeenCalledWith(expect.objectContaining({
        name: 'RoutingStartedEvent',
        streamId: '123'
      }));
    expect(apiDeps.eventFired)
      .toHaveBeenCalledWith(expect.objectContaining({
        name: 'RoutingInProgressEvent',
        streamId: '123'
      }));
    expect(apiDeps.eventFired)
      .toHaveBeenCalledWith('RoutingCompleteEvent');
    expect(apiDeps.eventFired)
      .toHaveBeenCalledWith(expect.objectContaining({
        name: 'RoutingCompleteEvent',
        endpoint: 'SIP/1002'
      }));
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

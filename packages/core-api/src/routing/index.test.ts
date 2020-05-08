import api, {workers} from './';
import {test} from '@open-cc/api-common';
import {ConnectedMessageRouter} from 'meshage';

describe('router-api', () => {
  let router: ConnectedMessageRouter;
  beforeEach(async () => {
    router = (await test(api)).router;
  });
  it('tracks worker state', async () => {
    await router.send({
      stream: 'workers',
      partitionKey: 'SIP/1002',
      data: {
        name: 'UpdateWorkerRegistration',
        address: 'SIP/1002',
        connected: true
      }
    });
    await wait(1);
    expect(workers['SIP/1002'].address).toBe('SIP/1002');
    expect(workers['SIP/1002'].connected).toBe(true);
    await router.send({
      stream: 'workers',
      partitionKey: 'SIP/1002',
      data: {
        name: 'UpdateWorkerRegistration',
        address: 'SIP/1002',
        connected: false
      }
    });
    await wait(1);
    expect(workers['SIP/1002'].connected).toBe(false);
  });
  it('routes', async () => {
    setTimeout(async () => {
      await router.send({
        stream: 'workers',
        partitionKey: 'SIP/1002',
        data: {
          name: 'UpdateWorkerRegistration',
          address: 'SIP/1002',
          connected: true
        }
      });
    }, 100);
    await router.send({
      stream: 'events',
      partitionKey: '123',
      data: {
        name: 'CallInitiatedEvent',
        streamId: '123',
        fromPhoneNumber: '1001',
        maxWaitAttempts: 3,
        waitInterval: 100
      }
    });
    await wait(21);
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '123',
      data: {
        name: 'RoutingInProgressEvent',
        duration: expect.any(Number),
        streamId: '123'
      }
    });
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '123',
      data: {
        name: 'RoutingCompleteEvent',
        endpoint: 'SIP/1002',
        streamId: '123'
      }
    });
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

import api from './';
import {
  ConnectedMessageRouter,
  test,
  TestApiDeps
} from '@open-cc/api-common';

describe('interaction-api', () => {
  let router : ConnectedMessageRouter;
  beforeEach(async () => {
    const apiDeps : TestApiDeps = await test(api);
    router = apiDeps.router;
  });
  it('initiates calls', async () => {
    await router.send({
      stream: 'interactions',
      partitionKey: '123',
      data: {
        name: 'started',
        interactionId: '123',
        channel: 'voice',
        fromAddress: '+15555555555',
        toAddress: '+15555555554'
      }
    });
    await wait(1);
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'CallInitiatedEvent'
      })
    });
  });
  it('ends calls', async () => {
    await router.send({
      stream: 'interactions',
      partitionKey: '123',
      data: {
        name: 'ended',
        interactionId: '123'
      }
    });
    await wait(1);
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '_',
      data: expect.objectContaining({
        name: 'InteractionEndedEvent'
      })
    });
  });
  it('gets interactions', async () => {
    await router.send({
      stream: 'interactions',
      partitionKey: '123',
      data: {
        name: 'started',
        interactionId: '123',
        channel: 'voice',
        fromAddress: '+15555555555',
        toAddress: '+15555555554'
      }
    });
    await wait(1);
    const res = await router.send({
      stream: 'interactions',
      partitionKey: '',
      data: {
        name: 'get'
      }
    });
    expect(res[0].fromAddress).toBe('+15555555555');
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

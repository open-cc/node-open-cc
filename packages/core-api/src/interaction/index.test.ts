import api from './';
import {
  ConnectedMessageRouter,
  test,
  TestApiDeps
} from '@open-cc/api-common';
import {
  ExternalInteractionInitiatedEvent,
  ExternalInteractionEndedEvent
} from './core/interaction';

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
      data: new ExternalInteractionInitiatedEvent(
        '123',
        'voice',
        '+15555555555',
        '+15555555554')
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
      data: new ExternalInteractionEndedEvent('123')
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
      data: new ExternalInteractionInitiatedEvent(
        '123',
        'voice',
        '+15555555551',
        '+15555555554')
    });
    await wait(1);
    const res = await router.send({
      stream: 'interactions',
      partitionKey: '',
      data: {
        name: 'get'
      }
    });
    expect(res[0].fromAddress).toBe('+15555555551');
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

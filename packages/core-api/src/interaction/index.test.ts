import api from './';
import {ApiDeps, test} from '@open-cc/api-common';
import {ConnectedMessageRouter} from 'meshage';

describe('interaction-api', () => {
  let router : ConnectedMessageRouter;
  beforeEach(async () => {
    const apiDeps : ApiDeps = await test(api);
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
        fromPhoneNumber: '+15555555555',
        toPhoneNumber: '+15555555554'
      }
    });
    await wait(1);
    expect(router.broadcast).toHaveBeenCalledWith({
      stream: 'events',
      partitionKey: '123',
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
      partitionKey: '123',
      data: expect.objectContaining({
        name: 'InteractionEndedEvent'
      })
    });
  });
  it('gets interactions', async () => {
    const res = await router.send({
      stream: 'interactions',
      partitionKey: '',
      data: {
        name: 'get'
      }
    });
    expect(res[0].fromPhoneNumber).toBe('+15555555555');
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

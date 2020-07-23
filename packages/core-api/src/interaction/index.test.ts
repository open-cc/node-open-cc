import api from './';
import {
  test,
  TestApiDeps
} from '@open-cc/api-common';
import {
  ExternalInteractionEndedEvent,
  ExternalInteractionInitiatedEvent
} from './core/interaction';

describe('interaction-api', () => {
  let apiDeps : TestApiDeps;
  beforeEach(async () => {
    apiDeps = await test(api);
  }, 20000);
  afterEach(async () => await apiDeps.shutdown());
  it('initiates calls', async () => {
    await apiDeps
      .stream('interactions')
      .send('123', new ExternalInteractionInitiatedEvent(
        '123',
        'voice',
        '+15555555555',
        '+15555555554'));
    await wait(1);
    expect(apiDeps
      .eventFired)
      .toHaveBeenCalledWith(expect.objectContaining({
        name: 'CallInitiatedEvent'
      }));
  });
  it('ends calls', async () => {
    await apiDeps
      .stream('interactions')
      .send('123', new ExternalInteractionEndedEvent('123'));
    await wait(1);
    expect(apiDeps.eventFired)
      .toHaveBeenCalledWith(expect.objectContaining({
        name: 'InteractionEndedEvent'
      }));
  });
  it('gets interactions', async () => {
    await apiDeps
      .stream('interactions')
      .send('123', new ExternalInteractionInitiatedEvent(
        '123',
        'voice',
        '+15555555551',
        '+15555555554'));
    await wait(1);
    const res = await apiDeps
      .stream('interactions')
      .send('', {
        name: 'get'
      });
    expect(res[0].fromAddress).toBe('+15555555551');
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

import api from './';
import {
  ApiDeps,
  test
} from '@open-cc/api-container';

describe('router-api', () => {
  it('routes', () => {
    let deps : ApiDeps = test(api);
    return deps.router.send({
      stream: 'events',
      partitionKey: '123',
      data: {
        name: 'CallInitiatedEvent',
        streamId: '123'
      }
    }).then(() => wait(1001))
      .then(() => {
        expect(deps.router.broadcast).toHaveBeenCalled();
      });
  });
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

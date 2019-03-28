import api from './';
import {
  ApiDeps,
  test
} from '@open-cc/api-container';

describe('router-api', () => {
  it('routes', () => {
    let deps : ApiDeps = test(api);
    deps.router.broadcast({
      stream: 'workers',
      partitionKey: '',
      data: {
        name: 'register',
        address: 'SIP/1002',
        connected: true
      }
    });
    return deps.router.send({
      stream: 'events',
      partitionKey: '123',
      data: {
        name: 'CallInitiatedEvent',
        streamId: '123',
        fromPhoneNumber: '1001'
      }
    }).then(() => wait(1001))
      .then(() => {
        expect(deps.router.broadcast).toHaveBeenCalledWith({
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
});

const wait = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));

import api from './';
import { test } from '@open-cc/api-container';

describe('router-api', () => {
  it('routes', () => {
    test(api).router.send({
      stream: 'events',
      partitionKey: '123',
      data: {}
    });
  });
});

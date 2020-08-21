import {ApiDeps, MessageHeader} from './interfaces';
import {
  test,
  TestApiDeps,
  getPort
} from './test-helper';
import fetch from 'node-fetch';

describe('api-common/server', () => {
  let testApi = ({subject} : ApiDeps) => {
    subject('test-stream').on('test-http-message', (msg : any, header : MessageHeader) => {
      return {
        http: {
          headers: {
            'Content-Type': 'application/json'
          },
          status: 202,
          body: { partitionKey: header.partitionKey, echo: msg }
        }
      }
    });
  };
  let apiDeps : TestApiDeps;
  beforeEach(async () => {
    apiDeps = await test(testApi);
  }, 20000);
  afterEach(async () => await apiDeps.shutdown());
  it('can respond to http requests', async () => {
    const res = await fetch(`http://localhost:${getPort('http')}/api/test-stream/1234?messageName=test-http-message`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: 'request-input'})
    });
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.partitionKey).toBe('1234');
    expect(json.echo.message).toBe('request-input');
  });
  it('can send the partition key in the request body', async () => {
    const res = await fetch(`http://localhost:${getPort('http')}/api/test-stream/{body.key}-123/?messageName=test-http-message`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({key: 'abc'})
    });
    const json = await res.json();
    expect(json.partitionKey).toBe('abc-123');
  });
});

import {stasisConnect} from './index';
import fetch from 'node-fetch';
import {StasisConnection} from './core/interfaces';

describe('connect', () => {
  it('connects', async () => {
    const fakeFetch : any = jest.fn(() => Promise.resolve({ ok: true }));
    const fakeAriInstance : any = {
      start: jest.fn(),
      on: jest.fn()
    };
    const fakeAriClient : any = {
      connect: jest.fn((url, username, password, cb) => {
        cb(null, fakeAriInstance);
      })
    };
    const connection : StasisConnection = await stasisConnect({
      url: 'http://asterisk:8080',
      username: 'un',
      password: 'pass',
      connectAttemptInterval: 1,
      ariClient: fakeAriClient,
      fetch: <typeof fetch> fakeFetch
    });
    connection.registerStasisApp('some-app', () => {});
    expect(fakeAriInstance.start).toHaveBeenCalledWith('some-app');
  });
});

import {stasisConnect} from './index';
import fetch from 'node-fetch';
import {StasisConnection} from './core/interfaces';

describe('connect', () => {
  it('connects', async () => {
    const fakeFetch : any = jest.fn(() => Promise.resolve({ ok: true }));
    const fakeAriInstance : any = {
      start: jest.fn(),
      on: jest.fn(),
      asterisk: {
        ping: jest.fn(() => Promise.resolve({asterisk_id: '123'}))
      }
    };
    const fakeAriModule : any = {
      connect: jest.fn((url, username, password, cb) => {
        cb(null, fakeAriInstance);
      })
    };
    const connection : StasisConnection = await stasisConnect({
      url: 'http://asterisk:8080',
      username: 'un',
      password: 'pass',
      connectAttemptInterval: 1,
      ariModule: fakeAriModule,
      fetch: <typeof fetch> fakeFetch
    });
    connection.registerStasisApp('some-app', () => {});
    expect(connection.asteriskId).toBe('123');
    expect(fakeAriInstance.start).toHaveBeenCalledWith('some-app');
  });
});

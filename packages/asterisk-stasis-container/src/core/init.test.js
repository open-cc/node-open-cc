const init = require('./init.ts');

describe('init', () => {
  describe('connecting', () => {
    let ariInstance;
    let ariClient;
    let superagent;
    let healthCheckResponse = () => Promise.resolve();
    let ariClientConnectResponse = (handler) => handler(null, ariInstance);
    beforeEach(() => {
      superagent = {
        get: jest.fn(() => ({
          auth: jest.fn(() => healthCheckResponse())
        }))
      };
      ariInstance = {
        start: jest.fn(),
        on: jest.fn((event, handler) => {
          handler({application: 'some-app'});
        })
      };
      ariClient = {
        connect: jest.fn((url, username, password, handler) => ariClientConnectResponse(handler))
      };
    });
    it('connects to ARI', () => {
      return new Promise((resolve) => {
        new init.ARIInitializer(ariClient, superagent)
          .connect({
            url: 'http://asterisk:8080'
          })
          .register('some-app', (ari) => (event) => {
            resolve({ari, event});
          });
      }).then((res) => {
        expect(res.ari).toBeDefined();
        expect(res.event).toBeDefined();
        expect(res.ari.start).toHaveBeenCalledWith('some-app');
      });
    });
  });
});

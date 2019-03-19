import { ARIInitializer, stasisApp } from './init';

describe('stasis', () => {
  describe('connecting', () => {
    let ariInstance;
    let ariClient;
    let fetchInstance;
    let healthCheckResponse = () => Promise.resolve({ ok: true });
    let ariClientConnectResponse = (handler) => handler(null, ariInstance);
    beforeEach(() => {
      fetchInstance = jest.fn(() => healthCheckResponse());
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
        new ARIInitializer(ariClient, fetchInstance)
          .connect({
            url: 'http://asterisk:8080'
          }, (ari) => {
            expect(ari).toBeDefined();
            return stasisApp('some-app', (event) => {
              expect(event).toBeDefined();
              resolve(ari);
            });
          });
      }).then((ari) => {
        expect(ari.start).toHaveBeenCalledWith('some-app');
      });
    });
  });
});

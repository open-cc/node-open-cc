const init = require('./init');

describe('init', () => {
    describe('connecting', () => {
        let ariClient;
        let superagent;
        let healthCheckResponse = () => Promise.resolve();
        let ariClientConnectResponse = (handler) => handler(null, 'ariInstance');
        beforeEach(() => {
            superagent = {
                get: jest.fn(() => ({
                    auth: jest.fn(() => healthCheckResponse())
                }))
            };
            ariClient = {
                connect: jest.fn((url, username, password, handler) => ariClientConnectResponse(handler))
            };
        });
        it('connects to ARI', () => {
            return init.connect(ariClient, superagent)('http://asterisk:8080', {
                auth: {
                    username: 'someUser',
                    password: 'somePassword'
                }
            }).then(res => {
                expect(res).toBe('ariInstance');
            });
        });
        describe('when the ARI connection attempt fails', () => {
            it('rejects', () => {
                ariClientConnectResponse = (handler) => handler(new Error('failed'));
                return init.connect(ariClient, superagent)('http://asterisk:8080', {
                    auth: {
                        username: 'someUser',
                        password: 'somePassword'
                    }
                }).catch(err => {
                    return err;
                }).then(err => err instanceof Error && err.message === 'failed');
            });
        });
        describe('when the max connection attempts are exceeded', () => {
            it('rejects', () => {
                healthCheckResponse = () => Promise.reject();
                return init.connect(ariClient, superagent)('http://asterisk:8080', {
                    auth: {
                        username: 'someUser',
                        password: 'somePassword'
                    },
                    maxConnectAttempts: 1,
                    connectAttemptInterval: 1
                }).catch(err => {
                    return err;
                }).then(err => err instanceof Error);
            });
        });
    });
    describe('starting', () => {
        it('starts the app', () => {
            const ariClient = {
                on: jest.fn(),
                start: jest.fn()
            };
            const appHandler = jest.fn();
            return init.initializeStarter(Promise.resolve(ariClient))
                .then(ari => ari.start('foo', appHandler))
                .then(() => {
                    expect(ariClient.__start).toHaveBeenCalledWith('foo');
                    ariClient.on.mock.calls[0][1]({
                        application: 'foo'
                    }, 'aChannel');
                    expect(appHandler).toHaveBeenCalled();
                });
        });
    });
});
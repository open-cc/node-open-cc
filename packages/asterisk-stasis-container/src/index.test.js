const container = require('./index');

describe('container', () => {
    it('connects', () => {
        const fakeConnect = jest.fn(() => Promise.resolve(''));
        const fakeCoreInit = {
            connect: () => fakeConnect,
            initializeStarter: () => {}
        };
        container.__init(fakeCoreInit, 'http://asterisk:8888', {
            auth: {
                username: 'someUser',
                password: 'somePassword'
            }
        });
        expect(fakeConnect).toHaveBeenCalled();
        expect(fakeConnect.mock.calls[0][0]).toBe('http://asterisk:8888');
        expect(fakeConnect.mock.calls[0][1].auth.username).toBe('someUser');
        expect(fakeConnect.mock.calls[0][1].auth.password).toBe('somePassword');
    });
});
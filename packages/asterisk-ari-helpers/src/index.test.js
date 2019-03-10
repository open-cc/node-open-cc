const helpers = require('./index');
let items = {};
let overrides = {};

describe('originate', () => {
  let ari;
  let channel;
  let helper;
  let makeChannel = () => triggerable('channel', base => {
    base.originate = jest.fn(() => {
      base.dispatch({name: 'StasisStart'}, base);
    });
    base.answer = jest.fn(handler => handler());
    base.hangup = jest.fn();
  });
  beforeEach(() => {
    items = {};
    overrides = {};
    ari = {
      start: jest.fn(),
      Channel: jest.fn(makeChannel),
      Bridge: jest.fn(() => triggerable('bridge', base => {
        base.create = jest.fn((config, handler) => handler(null, base));
        base.addChannel = jest.fn();
        base.destroy = jest.fn();
      }))
    };
    channel = makeChannel();
    helper = helpers(ari);
  });
  it('dials the endpoint', () => {
    helper
      .originate('SIP/1001', channel);
    expect(items.bridge[0].create.mock.calls[0][0].type).toBe('mixing');
    expect(items.channel[1].originate.mock.calls[0][0].endpoint).toBe('SIP/1001');
    expect(items.bridge[0].addChannel).toHaveBeenCalled();
    expect(items.bridge[0].addChannel.mock.calls[0][0].channel).toEqual(['channel-1', 'channel-2']);
    expect(items.channel[1].answer).toHaveBeenCalled();
  });
  it('calls the onAnswer callback if supplied', () => {
    const opts = {onAnswer: jest.fn()};
    helper
      .originate('SIP/1001', channel, opts);
    expect(opts.onAnswer).toHaveBeenCalled();
  });
  it('can throw an error when adding a channel', () => {
    overrides['bridge'] = {
      addChannel: (config, handler) => handler(new Error('failed'))
    };
    try {
      helper
        .originate('SIP/1001', channel);
      expect(1).toBe(2);
    } catch (err) {
    }
  });
  it('can throw an error when the dialed channel is answered', () => {
    overrides['channel'] = {
      answer: (handler) => handler(new Error('failed'))
    };
    try {
      helper
        .originate('SIP/1001', channel);
      expect(1).toBe(2);
    } catch (err) {
    }
  });
  describe('when the originated channel hangs up', () => {
    it('destroys the bridge', () => {
      helper
        .originate('SIP/1001', channel);
      items.channel[1].dispatch({name: 'StasisEnd'}, items.channel[1]);
      expect(items.bridge[0].destroy).toHaveBeenCalled();
    });
    it('can throw an error when destroying the bridge', () => {
      helper
        .originate('SIP/1001', channel);
      items.bridge[0].destroy = handler => handler(new Error('failed'));
      try {
        items.channel[1].dispatch({name: 'StasisEnd'}, items.channel[1]);
        expect(1).toBe(2);
      } catch (err) {
      }
    });
  });
  describe('when the initial channel hangs up', () => {
    it('hangs up the originated channel', () => {
      helper
        .originate('SIP/1001', channel);
      items.channel[0].dispatch({name: 'StasisEnd'}, items.channel[0]);
      expect(items.channel[1].hangup).toHaveBeenCalled();
    });
  });
  describe('when the channel is destroyed', () => {
    it('hanges up the initial channel', () => {
      helper
        .originate('SIP/1001', channel);
      items.channel[1].dispatch({name: 'ChannelDestroyed'}, items.channel[1]);
      expect(items.channel[0].hangup).toHaveBeenCalled();
    });
  });
});

const triggerable = (type, def) => {
  items[type] = items[type] || [];
  const eventDefs = {};
  const base = {
    on: jest.fn((event, handler) => {
      eventDefs[event] = eventDefs[event] || [];
      eventDefs[event].push(handler);
    })
  };
  base.dispatch = (event, payload) => {
    const handlers = eventDefs[event.name];
    if (handlers) {
      handlers.forEach(handler => {
        handler(event, payload);
      });
    }
  };
  def(base);
  items[type].push(base);
  base.id = `${type}-${items[type].length}`;
  if (overrides[type]) {
    return Object.assign(base, overrides[type], {});
  }
  return base;
};

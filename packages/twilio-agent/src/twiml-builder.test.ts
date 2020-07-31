import {TwimlBuilder} from './twiml-builder';

describe('TwimlBuilder', () => {
  let builder : TwimlBuilder;
  beforeEach(() => {
    builder = new TwimlBuilder();
  });
  it('can build conferences', () => {
    builder.conference('conf-1', {statusCallback: '/status-callback'});
    expect(builder.buildVoiceResponse().toString()).toContain('<Response><Dial><Conference statusCallback="/status-callback">conf-1</Conference></Dial></Response>');
    builder.conference('conf-1', {waitUrl: '/wait-url'});
    expect(builder.buildVoiceResponse().toString()).toContain('<Response><Dial><Conference statusCallback="/status-callback" waitUrl="/wait-url">conf-1</Conference></Dial></Response>');
  });
  it('can build says', () => {
    builder.say('say-1', 'hello');
    expect(builder.buildVoiceResponse().toString()).toContain('<Response><Say>hello</Say></Response>');
    builder.say('say-1', 'hello world');
    expect(builder.buildVoiceResponse().toString()).toContain('<Response><Say>hello world</Say></Response>');
    builder.say('say-1', 'hello world', {voice: "alice"});
    expect(builder.buildVoiceResponse().toString()).toContain('<Response><Say voice="alice">hello world</Say></Response>');
  });
  it('maintains order', () => {
    builder.say('say-1', 'hi');
    builder.conference('conf-1');
    builder.say('say-2', 'world');
    builder.say('say-1', 'hello');
    expect(builder.buildVoiceResponse().toString()).toContain('<Response><Say>hello</Say><Dial><Conference>conf-1</Conference></Dial><Say>world</Say></Response>');
  });
  it('returns null if nothing added', () => {
    expect(builder.buildVoiceResponse()).toBeNull();
  });
});


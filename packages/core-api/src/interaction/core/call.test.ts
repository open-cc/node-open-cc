import {CallService} from './call';
import {MemoryEventStore, EsContext} from "ddd-es-node";

describe('calls', () => {
  let memoryEventStore;
  let entityRepository;
  beforeEach(() => {
    memoryEventStore = new MemoryEventStore();
    const esContext = new EsContext(memoryEventStore);
    entityRepository = esContext.entityRepository;
  });
  describe('when making a call', () => {
    it('fires a CallInitiatedEvent', async () => {
      const callService = new CallService(entityRepository);
      await callService.initiateCall('call1234', '+15555555555', '+15555555554');
      expect(memoryEventStore.memoryEvents.length).toBe(1);
      expect(memoryEventStore.memoryEvents[0]).toEqual(expect.objectContaining({
        name: 'CallInitiatedEvent',
        channel: 'voice',
        fromAddress: '+15555555555',
        toAddress: '+15555555554',
        streamId: 'call1234'
      }));
    });
  });
});

import {promises as fs} from 'fs';
import {
  FlowElement,
  FlowModel,
  FlowProcessExecutor,
  getGraphs
} from './index';

describe('flow-processor', () => {
  it('can find flow graphs', async () => {
    const graphs = getGraphs(JSON.parse(`${await fs.readFile('./fixture.gliffy')}`));
    expect(graphs.length).toBe(2);
    expect(graphs[0].text).toBe('flow1');
    expect(graphs[1].text).toBe('flow2');
    expect(graphs[0].transitions[0].to.text).toBe('CallInitiatedEvent');
  });
  describe('flow model', () => {
    let graphs : FlowElement[];
    let flow : FlowModel;
    let flow2 : FlowModel;
    let executor : FlowProcessExecutor;
    let sound;
    beforeEach(async () => {
      executor = {
        execute: jest.fn(),
        instantiate: jest.fn(async (type, args) => {
          if (!sound) {
            sound = {id: '123', type, args, play: jest.fn(), stop: jest.fn()};
          }
          return sound;
        })
      };
      graphs = getGraphs(JSON.parse(`${await fs.readFile('./fixture.gliffy')}`));
      flow = new FlowModel(graphs[0], executor);
      flow2 = new FlowModel(graphs[1], executor);
    });
    it('can receive events', async () => {
      flow = await flow.receive({
        name: 'CallInitiatedEvent',
        streamId: 'the_interaction_id'
      });
      expect(flow.text)
        .toBe('CallInitiatedEvent-route-play-sound');
      expect(executor.execute).toHaveBeenCalledWith('route',
        expect.objectContaining({name: 'CallInitiatedEvent'}));
      expect(executor.instantiate).toHaveBeenCalledWith(
        'sound',
        'the_interaction_id',
        'moh');
      expect(sound.play).toHaveBeenCalledWith('the_interaction_id', 'moh');
      flow = await flow.receive({
        name: 'RoutingCompleteEvent',
        endpoint: 'the_endpoint',
        interactionId: 'the_interaction_id'
      });
      expect(executor.execute).toHaveBeenCalledWith(
        'bridge', 'the_interaction_id', 'the_endpoint');
      expect(flow.text).toBe('RoutingCompleteEvent-bridge');
      flow = await flow.receive({
        name: 'InteractionAnsweredEvent'
      });
      expect(sound.stop).toHaveBeenCalledWith('the_interaction_id', 'moh');
      expect(flow.text).toBe('InteractionAnsweredEvent-stop-sound');
      flow = await flow.receive({name: 'InteractionPartyLeftEvent'});
      expect(executor.instantiate).toHaveBeenCalledWith(
        'sound',
        'the_interaction_id',
        'moh');
      expect(executor.execute).toHaveBeenCalledWith('route',
        expect.objectContaining({name: 'CallInitiatedEvent'}));
    });
    it('merges transitions from actions', async () => {
      flow2 = await flow2
        .receive({name: 'EventA'});
      const nextFlowGraph = (flow2 as any).graph;
      expect(nextFlowGraph.transitions.length).toBe(2);
      expect(nextFlowGraph.transitions[0].to.text).toBe('EventC');
      expect(nextFlowGraph.transitions[1].to.text).toBe('EventB');
      const receivedB = await flow2.receive({name: 'EventB'});
      expect((receivedB as any).graph.transitions.length).toBe(0);
      const receivedC = await flow2.receive({name: 'EventC'});
      expect((receivedC as any).graph.transitions.length).toBe(1);
    });
    it('can store data', async () => {
      flow2 = await (await flow2
        .receive({name: 'EventA', eventData: 'eventAData'}))
        .receive({name: 'EventC', eventData: 'eventCData'});
      expect(flow2.context.data).toEqual(expect.objectContaining({storedData: 'eventAData'}));
      expect(flow2.context.data).toEqual(expect.objectContaining({storedData2: 'eventCData'}));
    });
    it('storage nodes immediately transition', async () => {
      flow2 = await (await flow2
        .receive({name: 'EventA'}))
        .receive({name: 'EventC'});
      expect(flow2.text).toBe('EventC-store-storedData2-b');
    });
    it('successive actions immediately transition', async () => {
      const s1 = await flow2.receive({name: 'EventA'});
      const s2 = await s1.receive({name: 'EventC'});
      const s3 = await s2.receive({name: 'EventD'});
      expect(s3.text).toBe('EventD-c-d');
    });
    it('can interpolate variables into text', async () => {
      const s1 = await flow2.receive({name: 'EventA'});
      expect(s1.text).toBe('EventA-store-storedData-a');
    });
    it('processes events sequentially', async () => {
      executor.instantiate = async (type) => {
        return {
          id: `${type}_1`, play: async () => {
            await delay(100);
          }
        };
      };
      setTimeout(async () => {
        flow = await flow.receive({
          name: 'RoutingCompleteEvent'
        });
      }, 1);
      flow = await flow.receive({
        name: 'CallInitiatedEvent',
        streamId: 'the_interaction_id'
      });
      expect(flow.text).toBe('RoutingCompleteEvent-bridge');
    });
  });
});

const delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

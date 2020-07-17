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
    beforeEach(async () => {
      executor = {
        execute: jest.fn(),
        instantiate: jest.fn(async (type, args) => {
          return {id: '123', type, args};
        })
      };
      graphs = getGraphs(JSON.parse(`${await fs.readFile('./fixture.gliffy')}`));
      flow = new FlowModel(graphs[0], executor);
      flow2 = new FlowModel(graphs[1], executor);
    });
    it('can receive events', async () => {
      flow = await flow.receive({name: 'CallInitiatedEvent'});
      expect(flow.text)
        .toBe('CallInitiatedEvent-route-play-sound');
      expect(executor.execute).toHaveBeenCalledWith('route');
      expect(executor.execute).toHaveBeenCalledWith(
        'play',
        expect.objectContaining({id: '123'}),
        'http://asdasd');
      flow = await flow.receive({name: 'RoutingCompleteEvent'});
      expect(executor.execute).toHaveBeenCalledWith(
        'stop',
        expect.objectContaining({id: '123'}));
      expect(flow.text).toBe('RoutingCompleteEvent-bridge-stop-sound');
    });
    it('merges transitions from actions', async () => {
      flow2 = await flow2
        .receive({name: 'EventA'});
      const nextFlowGraph = (flow2 as any).graph;
      expect(nextFlowGraph.transitions.length).toBe(2);
      expect(nextFlowGraph.transitions[0].to.text).toBe('EventB');
      expect(nextFlowGraph.transitions[1].to.text).toBe('EventC');
      flow2 = await flow2.receive({name: 'EventB'});
      expect((flow2 as any).graph.transitions.length).toBe(0);
    });
  });
});

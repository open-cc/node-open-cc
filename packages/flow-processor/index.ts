const TYPE_INITIALIZER = 'com.gliffy.shape.flowchart.flowchart_v1.default.document';
const TYPE_EVENT = 'com.gliffy.shape.flowchart.flowchart_v1.default.input_output';
const TYPE_CONNECTOR = 'com.gliffy.shape.basic.basic_v1.default.line';
const TYPE_PROCESS = 'com.gliffy.shape.flowchart.flowchart_v1.default.process';
const TRANSITION_DEFAULT_ACTION = '_go';

export interface FlowTransition {
  text : string;
  to : FlowElement;
}

export interface FlowElementHeader {
  uid : string;
  text : string;
}

export interface FlowElement extends FlowElementHeader {
  transitions : FlowTransition[]
}

export interface FlowObject {
  id : string;
}

export interface FlowProcessExecutor {
  execute(command : string, ...args : any[]) : Promise<any>;

  instantiate(type : string, ...args : any[]) : Promise<FlowObject>;
}

function getText(object : any) {
  return (object.children || []).reduce((title, child) => {
    if (child.graphic && child.graphic.type === 'Text' && child.graphic.Text) {
      title = (child.graphic.Text.html || '').replace(/<[^>]+>/g, '').trim();
    }
    return title;
  }, '');
}

export function getGraphs(data : any) : FlowElement[] {
  const graph = data.stage.objects
    .filter(o => o.uid === TYPE_CONNECTOR)
    .reduce((graph, line) => {
      const {constraints} = line;
      if (constraints && constraints.startConstraint && constraints.endConstraint) {
        const startNodeId = constraints.startConstraint.StartPositionConstraint.nodeId;
        const endNodeId = constraints.endConstraint.EndPositionConstraint.nodeId;
        graph[endNodeId] = graph[endNodeId] || {
          id: endNodeId,
          transitions: []
        };
        graph[startNodeId] = graph[startNodeId] || {
          id: startNodeId, transitions: []
        };
        const transition = {
          to: graph[endNodeId],
          text: getText(line) || TRANSITION_DEFAULT_ACTION
        };
        graph[startNodeId].transitions.push(transition);
      }
      return graph;
    }, {});
  return data.stage.objects
    .filter(o => o.uid === TYPE_INITIALIZER)
    .map(initializer => {
      const initializerId = `${initializer.id}`;
      const graphIds = Object.keys(graph);
      graphIds.forEach(nodeId => {
        data.stage.objects.forEach(object => {
          if (`${object.id}` === nodeId) {
            graph[nodeId].uid = object.uid;
            graph[nodeId].text = getText(object);
          }
        });
      });
      return graph[initializerId];
    });
}

export class FlowModel implements FlowElementHeader {
  constructor(private readonly graph : FlowElement,
              private readonly executor : FlowProcessExecutor) {
    this.graph = graph;
  }

  async receive(event : any) : Promise<FlowModel> {
    for (const transition of this.graph.transitions) {
      if (transition.to.uid === TYPE_EVENT &&
        transition.to.text === event.name) {
        return new FlowModel(transition.to, this.executor).next();
      }
    }
    return this;
  }

  private async next() : Promise<FlowModel> {
    let nextFlowTransitions : FlowElement = {
      uid: this.graph.uid,
      text: this.graph.text,
      transitions: this.graph
        .transitions
        .filter(transition => transition.to.uid !== TYPE_PROCESS)
    };
    for (const transition of this.graph.transitions) {
      if (transition.to.uid === TYPE_PROCESS) {
        let description = [];
        const args = transition.to.text.split(/\n/).map(arg => arg.trim());
        if (transition.text !== TRANSITION_DEFAULT_ACTION) {
          const transitionToNode = (transition.to as any);
          const command = transition.text;
          const type = args.shift();
          if (!transitionToNode._flowObject) {
            const flowObject : FlowObject = await this.executor.instantiate(type, ...args);
            // Store instance of instantiated object on transition.to process node
            transitionToNode._flowObject = flowObject;
            await this.executor.execute(command, flowObject, ...args);
          } else {
            await this.executor.execute(command, transitionToNode._flowObject);
          }
          description.push(command);
          description.push(type);
        } else {
          const command = args.shift();
          await this.executor.execute(command, ...args);
          description.push(command);
        }
        // After executing the actions, merge the new states resulting from the action to the current flow
        nextFlowTransitions.text = [nextFlowTransitions.text, description.join('-')].join('-');
        nextFlowTransitions
          .transitions
          .push(...(transition.to.transitions || []));
      }
    }
    return new FlowModel(nextFlowTransitions, this.executor);
  }

  public get uid() : string {
    return this.graph.uid;
  }

  public get text() : string {
    return this.graph.text;
  }
}

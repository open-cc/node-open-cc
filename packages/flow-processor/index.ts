const TYPE_INITIALIZER = 'com.gliffy.shape.flowchart.flowchart_v1.default.document';
const TYPE_EVENT = 'com.gliffy.shape.flowchart.flowchart_v1.default.input_output';
const TYPE_CONNECTOR = 'com.gliffy.shape.basic.basic_v1.default.line';
const TYPE_PROCESS = 'com.gliffy.shape.flowchart.flowchart_v1.default.process';
const TYPE_STORE = 'com.gliffy.shape.flowchart.flowchart_v1.default.database';
const TRANSITION_DEFAULT_ACTION = '_go';

export interface FlowTransition {
  id : string;
  text : string;
  to : FlowElement;
  pos : number;
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

export interface FlowContext {
  eventsReceived : { [key : string] : any[] };
  data : { [key : string] : any };
}

function getText(object : any) {
  return (object.children || []).reduce((title, child) => {
    if (child.graphic && child.graphic.type === 'Text' && child.graphic.Text) {
      title = (child.graphic.Text.html || '').replace(/<[^>]+>/g, '').trim();
    }
    return title;
  }, '');
}

function sortTransitions(transitions : FlowTransition[]) {
  transitions
    .sort((t1, t2) => {
      return t1.pos - t2.pos;
    });
}

export function getGraphs(data : any) : FlowElement[] {
  const dataStageObjects = data.stage.objects
    .reduce((objs, obj) => {
      objs[obj.id] = obj;
      return objs;
    }, {});
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
        const transition : FlowTransition = {
          id: `${Math.floor(100000 + Math.random() * 900000)}`,
          to: graph[endNodeId],
          text: getText(line) || TRANSITION_DEFAULT_ACTION,
          pos: dataStageObjects[endNodeId].y
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
      graphIds
        .forEach(nodeId => {
          const object = dataStageObjects[nodeId];
          if (object) {
            graph[nodeId].uid = object.uid;
            graph[nodeId].text = getText(object);
            sortTransitions(graph[nodeId].transitions);
          }
        });
      return graph[initializerId];
    })
    .sort((g1, g2) => dataStageObjects[g1.id].y - dataStageObjects[g2.id].y);
}

class BatchingFlowProcessExecutor implements FlowProcessExecutor {
  public readonly commands : any[] = [];

  execute(command : string, ...args : any[]) : Promise<any> {
    this.commands.push({
      action: 'execute',
      command,
      args
    });
    return Promise.resolve();
  }

  instantiate(type : string, ...args : any[]) : Promise<FlowObject> {
    this.commands.push({
      action: 'instantiate',
      type,
      args
    });
    return Promise.resolve({
      id: 'tbd'
    });
  }

}

export class FlowModel implements FlowElementHeader {
  constructor(private readonly graph : FlowElement,
              private readonly executor : FlowProcessExecutor,
              private readonly _context : FlowContext = {
                eventsReceived: {},
                data: {}
              },
              private readonly batchMode : boolean = false) {
    this.graph = graph;
    this.parseArg = this.parseArg.bind(this);
  }

  public batch() : FlowModel {
    return new FlowModel(this.graph, this.executor, this._context, true);
  }

  public get context() {
    return JSON.parse(JSON.stringify(this._context));
  }

  async receive(event : any) : Promise<FlowModel> {
    return this.sendEvent(await this.next(this), event);
  }

  private evaluateText(text : string) : string {
    return text.replace(/({[^}]+})/, (m) => {
      m = m.replace(/(^{|}$)/g, '').trim();
      return this.parseArg(m);
    });
  }

  private async sendEvent(model : FlowModel, event : any) : Promise<FlowModel> {
    for (const transition of model.graph.transitions) {
      if (transition.to.uid === TYPE_EVENT &&
        this.evaluateText(transition.to.text) === event.name) {
        transition.to.text = this.evaluateText(transition.to.text);
        this._context.eventsReceived[event.name] = model._context.eventsReceived[event.name] || [];
        this._context.eventsReceived[event.name].push(event);
        if (this.batchMode) {
          const executor : BatchingFlowProcessExecutor = new BatchingFlowProcessExecutor();
          const next : FlowModel = await model.next(new FlowModel(transition.to, executor, model._context, model.batchMode));
          await Promise.all(await model.executor.execute('@batch', executor.commands));
          return new FlowModel(next.graph, model.executor, model._context, model.batchMode);
        } else {
          return model.next(new FlowModel(transition.to, model.executor, model._context, model.batchMode));
        }
      }
    }
    return model;
  }

  private async next(model : FlowModel) : Promise<FlowModel> {
    let nextFlowTransitions : FlowElement = {
      uid: model.graph.uid,
      text: '',
      transitions: model.graph.transitions.filter(t => t.to.uid === TYPE_EVENT)
    };
    let description = [];
    const transitionsExecuted = [];
    for (const transition of model.graph.transitions) {
      switch (transition.to.uid) {
        case TYPE_PROCESS: {
          transitionsExecuted.push(transition);
          const args = transition.to.text.split(/\n/).map(arg => arg.trim());
          const firstArg = args.shift();
          const rest = args.map(model.parseArg);
          if (transition.text !== TRANSITION_DEFAULT_ACTION) {
            const transitionToNode = (transition.to as any);
            const command = transition.text;
            const type = firstArg;
            if (!transitionToNode._flowObject) {
              // Store instance of instantiated object on transition.to process node
              transitionToNode._flowObject = await model.executor.instantiate(type, ...rest);
            }
            // Call the command on the instantiated object
            if (transitionToNode._flowObject[command]) {
              transitionToNode._flowObject[command].bind(transitionToNode._flowObject)(...rest);
            } else if (transitionToNode._flowObject.method_missing) {
              transitionToNode._flowObject.method_missing.bind(transitionToNode._flowObject)(command, ...rest);
            }
            description.push(command);
            description.push(type);
          } else {
            const command = firstArg;
            await model.executor.execute(command, ...rest);
            description.push(command);
          }
          break;
        }
        case TYPE_STORE: {
          transitionsExecuted.push(transition);
          const matcher = /(.*) ?= ?(.*)/.exec(transition.to.text);
          if (matcher) {
            const contextVar = matcher[1].trim();
            description.push(`store-${contextVar}`);
            model._context.data[contextVar] = model.parseArg(matcher[2].trim());
          }
          break;
        }
      }
    }
    if (transitionsExecuted.length > 0) {
      // all the actionable transitions should have been executed
      while (transitionsExecuted.length > 0) {
        const transition = transitionsExecuted.shift();
        const nextFlow = await this.next(new FlowModel({
          ...(transition.to),
          text: description.join('-')
        }, model.executor, model._context, model.batchMode));
        nextFlowTransitions.text = [model.text, nextFlow.text].join('-');
        nextFlowTransitions.transitions = [...nextFlowTransitions.transitions, ...nextFlow.graph.transitions];
      }
      sortTransitions(nextFlowTransitions.transitions);
      return new FlowModel(nextFlowTransitions, model.executor, model._context, model.batchMode);
    }
    return model;
  }

  private parseArg(arg : string) {
    arg = arg.trim();
    const parts = arg.split(/\./);
    let val : any = arg;
    if (parts[0] === 'context') {
      return this._context.data[parts[1]];
    }
    while (parts.length > 0) {
      const part = parts.shift();
      const matcher = /([^\[]+)\[([0-9]+|n)]$/.exec(part);
      if (matcher) {
        const eventsReceivedOfType = this._context.eventsReceived[matcher[1]];
        if (eventsReceivedOfType) {
          const pos = matcher[2] === 'n' ? eventsReceivedOfType.length - 1 : parseInt(matcher[2], 10);
          val = eventsReceivedOfType[pos];
        } else {
          val = {};
        }
      } else if (typeof val === 'object') {
        val = val[part];
      } else {
        val = part;
      }
    }
    return val;
  }

  public get uid() : string {
    return this.graph.uid;
  }

  public get text() : string {
    return this.graph.text;
  }
}

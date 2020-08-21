import {ApiDeps} from '@open-cc/api-common';
import {
  FlowObject,
  FlowProcessExecutor
} from '@open-cc/flow-processor';
import {flowService} from './src/common';

class StreamFlowProcessExecutor implements FlowProcessExecutor {

  constructor(private apiDeps : ApiDeps) {
  }

  public async execute(command : string, ...args : any[]) : Promise<any> {
    switch (command) {
      case 'route': {
        const event = args[0];
        await this.apiDeps.subject('routing')
          .send(event.streamId, {...event, name: command});
        break;
      }
      case 'bridge': {
        const interactionId = args[0];
        await this.apiDeps.subject(interactionId)
          .send(interactionId, {
            name: 'bridge',
            endpoint: args[1],
            interactionId
          });
        break;
      }
    }
  }

  public async instantiate(type : string, ...args : any[]) : Promise<FlowObject> {
    switch (type) {
      case 'sound':
        return {
          id: 'moh',
          play: async (interactionId) => {
            await this.apiDeps.subject(interactionId)
              .send(interactionId, {name: 'startMoh', interactionId})
          },
          stop: async (interactionId) => this.apiDeps.subject(interactionId)
            .send(interactionId, {name: 'stopMoh', interactionId})
        } as FlowObject;
    }
    // @TODO - clean this up
    return {id: 'null'};
  }
}

export default flowService(process.env.FLOW,
  (apiDeps) => new StreamFlowProcessExecutor(apiDeps));

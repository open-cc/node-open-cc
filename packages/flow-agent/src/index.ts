import {EntityEvent} from 'ddd-es-node';
import {ApiDeps} from '@open-cc/api-common';
import {
  constants as fs_const,
  promises as fs
} from 'fs';
import {
  FlowModel,
  FlowObject,
  FlowProcessExecutor,
  getGraphs
} from '@open-cc/flow-processor';
import * as debug from 'debug';

const log = debug('');

const flowModels : { [key : string] : FlowModel } = {};

export default async ({stream} : ApiDeps) => {

  class StreamFlowProcessExecutor implements FlowProcessExecutor {

    public async execute(command : string, ...args : any[]) : Promise<any> {
      switch (command) {
        case 'route': {
          const event = args[0];
          await stream('routing')
            .send(event.streamId, {...event, name: command});
          break;
        }
        case 'bridge': {
          const interactionId = args[0];
          await stream(interactionId)
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
              await stream(interactionId)
                .send(interactionId, {name: 'startMoh', interactionId})
            },
            stop: async (interactionId) => stream(interactionId)
              .send(interactionId, {name: 'stopMoh', interactionId})
          } as FlowObject;
      }
      // @TODO - clean this up
      return {id: 'null'};
    }
  }

  if (process.env.FLOW) {
    fs.access(process.env.FLOW, fs_const.F_OK)
      .then(() => {
        stream('events')
          .on('*', async (event : EntityEvent) => {
            try {
              if (!flowModels[event.streamId]) {
                flowModels[event.streamId] = new FlowModel(getGraphs(JSON.parse(`${await fs.readFile(process.env.FLOW)}`))[0],
                  new StreamFlowProcessExecutor());
              }
              flowModels[event.streamId] = await flowModels[event.streamId].receive(event);
            } catch (err) {
              log(err);
            }
          });
      })
      .catch((err) => {
        log(`File ${process.env.FLOW} is not accessible`, err);
      });
  } else {
    log('FLOW not provided');
  }

};

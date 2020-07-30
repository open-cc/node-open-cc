import {EntityEvent} from 'ddd-es-node';
import {ApiDeps} from '@open-cc/api-common';
import {
  constants as fs_const,
  promises as fs
} from 'fs';
import {
  FlowModel,
  FlowProcessExecutor,
  getGraphs
} from '@open-cc/flow-processor';
import * as debug from 'debug';

const log = debug('');

const flowModels : { [key : string] : FlowModel } = {};

export function flowService(flowDefinition: string,
                                          flowProcessorExecutorProvider : (apiDeps : ApiDeps) => FlowProcessExecutor) {
  return async function (apiDeps : ApiDeps) {
    if (flowDefinition) {
      fs.access(flowDefinition, fs_const.F_OK)
        .then(() => {
          apiDeps.stream('events')
            .on('*', async (event : EntityEvent) => {
              try {
                if (!flowModels[event.streamId]) {
                  flowModels[event.streamId] = new FlowModel(getGraphs(JSON.parse(`${await fs.readFile(flowDefinition)}`))[0],
                    flowProcessorExecutorProvider(apiDeps));
                }
                log(`Flow ${flowModels[event.streamId].text} ${event.streamId} received`, JSON.stringify(event));
                const next = await flowModels[event.streamId].receive(event);
                log(`Next flow state ${next.text}`);
                flowModels[event.streamId] = next;
              } catch (err) {
                log(err);
              }
            });
        })
        .catch((err) => {
          log(`File ${flowDefinition} is not accessible`, err);
        });
    } else {
      log('FLOW not provided');
    }
  }
}

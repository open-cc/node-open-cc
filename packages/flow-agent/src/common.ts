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

export function flowService(flowDefinition : string,
                            flowProcessorExecutorProvider : (apiDeps : ApiDeps) => FlowProcessExecutor,
                            onNext? : (streamId : string, next : FlowModel) => void) {
  const flowServiceLog = log.extend('debug');
  return async function (apiDeps : ApiDeps) {
    if (flowDefinition) {
      fs.access(flowDefinition, fs_const.F_OK)
        .then(() => {
          apiDeps.subject('events')
            .before(async (event : EntityEvent) => {
              try {
                if (!flowModels[event.streamId]) {
                  flowModels[event.streamId] = new FlowModel(getGraphs(JSON.parse(`${await fs.readFile(flowDefinition)}`))[0],
                    flowProcessorExecutorProvider(apiDeps));
                }
                const currentText = flowModels[event.streamId].text;
                flowServiceLog(`Flow ${flowModels[event.streamId].text} ${event.streamId} received %o`, event);
                const next = await flowModels[event.streamId].receive(event);
                const nextText = next.text;
                if (currentText !== nextText) {
                  flowServiceLog(`Next flow state ${next.text}`);
                  if (onNext) {
                    await onNext(event.streamId, flowModels[event.streamId]);
                  }
                }
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

import {ApiDeps} from '@open-cc/api-common';
import {WorkerService} from './core/worker';
import {Route} from './core/route';
import * as debug from 'debug';

const log = debug('');

export let workerService : WorkerService;

export default async ({router, entityRepository} : ApiDeps) => {

  workerService = new WorkerService(entityRepository);

  await router.register(
    {
      stream: 'events',
      messageHandler: async (message : any) => {
        workerService.handleMessage(message);
        switch (message.name) {
          case 'CallInitiatedEvent': {
            log(`Received CallInitiatedEvent: routing interaction ${message.streamId}`, message);
            const route : Route = await entityRepository
              .load(Route, message.streamId, workerService);
            await route.routeInteraction(
              message.streamId,
              message.fromAddress,
              message.waitInterval,
              message.waitTimeout);
          }
            break;
          case 'InteractionEndedEvent': {
            log(`Received InteractionEndedEvent for ${message.streamId}`);
            const route : Route = await entityRepository
              .load(Route, message.streamId, workerService);
            await route.cancel();
            break;
          }
        }
      }
    },
    {
      stream: 'workers',
      messageHandler: async (message : any) => {
        switch (message.name) {
          case 'UpdateWorkerRegistration':
            try {
              const parts = /^sip:([^@]+)@.*/.exec(message.address);
              if (parts && parts.length > 0) {
                message.address = `SIP/cluster/${parts[1]}`;
              }
              await workerService
                .updateWorkerRegistration(message.workerId, message.address, message.connected);
              return {message: `Success`}
            } catch (err) {
              return {message: `Failed to update worker registration - ${err.message}`}
            }
          case 'GetWorkers':
            return {workers: workerService.getWorkersState()};
        }
        return {message: `Unknown message: ${message.name}`};
      }
    });

};

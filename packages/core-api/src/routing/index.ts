import {ApiDeps} from '@open-cc/api-common';
import {
  InteractionEndedEvent
} from '../';
import {
  UpdateWorkerRegistration,
  WorkerService,
  WorkerState
} from './core/worker';
import {
  BeginRoutingCommand,
  Route
} from './core/route';
import * as debug from 'debug';

const log = debug('');

export let workerService : WorkerService;

export default async ({stream, entityRepository} : ApiDeps) => {

  workerService = new WorkerService(entityRepository);

  stream('events')
    .on('before', async (event : any) => {
      workerService.handleMessage(event);
    })
    .on(InteractionEndedEvent, async (event : InteractionEndedEvent) => {
      log(`Received InteractionEndedEvent for ${event.streamId}`);
      const route : Route = await entityRepository
        .load(Route, event.streamId, workerService);
      await route.cancel();
    });

  stream('routing')
    .on('route', async (command : BeginRoutingCommand) => {
      log(`Received ${command.name}: routing interaction ${command.streamId}`, command);
      const route : Route = await entityRepository
        .load(Route, command.streamId, workerService);
      await route.routeInteraction(
        command.streamId,
        command.fromAddress,
        command.waitInterval,
        command.waitTimeout);
    });

  stream('workers')
    .on(UpdateWorkerRegistration, async (message : UpdateWorkerRegistration) => {
      try {
        await Promise.all((message.registrations || [])
          .map((registration) => {
            return workerService
              .updateWorkerRegistration(
                  registration.workerId,
                  registration.address,
                  registration.routingAddress,
                  registration.connected);
          }));
        return {message: 'Success'}
      } catch (err) {
        return {message: `Failed to update worker registration - ${err.message}`}
      }
    })
    .on('get_workers', () => {
      return {workers: workerService.getWorkersState()};
    })
    .on('get_worker_address', async ({workerId}) => {
      const workerState : WorkerState = workerService.getWorkersState()[workerId];
      return workerState ? workerState.address : 'none';
    });

};

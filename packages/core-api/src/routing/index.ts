import {ApiDeps} from '@open-cc/api-common';
import {InteractionEndedEvent} from '../';
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

export default async ({subject, entityRepository} : ApiDeps) => {

  const workerService = new WorkerService(entityRepository);

  subject('events')
    .before(async (event : any) => {
      workerService.handleMessage(event);
    })
    .on(InteractionEndedEvent, async (event : InteractionEndedEvent) => {
      log(`Received InteractionEndedEvent for ${event.streamId}`);
      const route : Route = await entityRepository
        .load(Route, event.streamId, workerService);
      await route.cancel();
    });

  subject('routing')
    .on('route', async (command : BeginRoutingCommand) => {
      log(`Received ${command.name}: routing interaction ${command.streamId} %O`, command);
      const route : Route = await entityRepository
        .load(Route, command.streamId, workerService);
      await route.routeInteraction(
        command.streamId,
        command.fromAddress,
        command.waitInterval,
        command.waitTimeout);
    });

  subject('workers')
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

import {ApiDeps, MessageHeader} from '@open-cc/api-common';
import {
  CallInitiatedEvent,
  InteractionEndedEvent
} from '../';
import {
  UpdateWorkerRegistration,
  WorkerService,
  WorkerState
} from './core/worker';
import {Route} from './core/route';
import * as debug from 'debug';

const log = debug('');

export let workerService : WorkerService;

export default async ({stream, entityRepository} : ApiDeps) => {

  workerService = new WorkerService(entityRepository);

  stream('events')
    .on('before', async (event : any) => {
      workerService.handleMessage(event);
    })
    .on(CallInitiatedEvent, async (event : CallInitiatedEvent) => {
      log(`Received CallInitiatedEvent: routing interaction ${event.streamId}`, event);
      const route : Route = await entityRepository
        .load(Route, event.streamId, workerService);
      await route.routeInteraction(
        event.streamId,
        event.fromAddress,
        (event as any).waitInterval,
        (event as any).waitTimeout);
    })
    .on(InteractionEndedEvent, async (event : InteractionEndedEvent) => {
      log(`Received InteractionEndedEvent for ${event.streamId}`);
      const route : Route = await entityRepository
        .load(Route, event.streamId, workerService);
      await route.cancel();
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
    .on('GetWorkers', () => {
      return {workers: workerService.getWorkersState()};
    })
    .on('GetWorkerAddress', async (message: any, header: MessageHeader) => {
      const workerState : WorkerState = workerService.getWorkersState()[header.partitionKey];
      return workerState ? workerState.address : 'none';
    });

};

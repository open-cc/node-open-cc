import {ApiDeps} from '@open-cc/api-common';
import {
  CallInitiatedEvent,
  InteractionEndedEvent
} from '../';
import {WorkerService, UpdateWorkerRegistration} from './core/worker';
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
            const parts = /^sip:([^@]+)@.*/.exec(registration.address);
            if (parts && parts.length > 0) {
              registration.address = `SIP/cluster/${parts[1]}`;
            }
            return workerService
              .updateWorkerRegistration(registration.workerId, registration.address, registration.connected);
          }));
        return {message: 'Success'}
      } catch (err) {
        return {message: `Failed to update worker registration - ${err.message}`}
      }
    })
    .on('GetWorkers', () => {
      return {workers: workerService.getWorkersState()};
    });

};

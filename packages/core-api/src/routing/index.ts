import {ApiDeps} from '@open-cc/api-common';
import {MessageHeader} from 'meshage';
import {
  WorkerAddressAssignedEvent,
  WorkerService,
  WorkerStatusChangedEvent
} from './core/worker';

interface Worker {
  address : string;
  connected : boolean;
}

interface AssignmentState {
  workerId? : string;
}

export const workers : { [key : string] : Worker } = {};

const assignmentState : { [key : string] : AssignmentState } = {};

const getConnectedWorker = (filter : (worker : Worker) => boolean) : Worker => {
  return Object.keys(workers)
    .map(id => workers[id])
    .filter(worker => worker.connected && filter(worker))[0];
};

const wait = (ms : number) => new Promise(resolve => setTimeout(() => resolve(), ms));

const waitForConnectedWorker = async (interactionId : string,
                                      filter : (worker : Worker) => boolean,
                                      attempts : number,
                                      interval : number,
                                      onRetry : (duration : number) => Promise<void>) : Promise<Worker> => {
  let attempt = attempts;
  while (attempt > 0) {
    if (!assignmentState[interactionId]) {
      // TODO, this is horrible
      return {address: 'disconnected', connected: false};
    }
    const worker : Worker = getConnectedWorker(filter);
    if (worker) {
      assignmentState[interactionId] = {
        workerId: worker.address
      };
      return worker;
    } else {
      attempt--;
      await onRetry((attempts - attempt) * interval);
      await wait(interval);
    }
  }
  throw new Error('Failed to find worker');
};

export default async ({router, entityRepository, log} : ApiDeps) => {

  const workerService : WorkerService = new WorkerService(entityRepository);

  await router.register(
    {
      stream: 'events',
      messageHandler: async (message : any) => {
        switch (message.name) {
          case 'WorkerAddressAssignedEvent': {
            const event : WorkerAddressAssignedEvent = <WorkerAddressAssignedEvent>message;
            workers[event.streamId] = {
              ...(workers[event.streamId] || {
                address: '',
                connected: false
              }),
              address: event.address
            };
            break;
          }
          case 'WorkerStatusChangedEvent': {
            const event : WorkerStatusChangedEvent = <WorkerStatusChangedEvent>message;
            workers[event.streamId] = {
              ...(workers[event.streamId] || {
                address: '',
                connected: false
              }),
              connected: event.connected
            };
            break;
          }
          case 'CallInitiatedEvent': {
            log(`Received CallInitiatedEvent: routing interaction ${message.streamId}`, message);
            assignmentState[message.streamId] = {};
            const notCaller = (worker : Worker) : boolean => {
              return worker.address.indexOf(`/${(message as any).fromPhoneNumber}`) === -1;
            };
            const workerNotBusy = (worker : Worker) : boolean => {
              return Object.keys(assignmentState).filter(a => assignmentState[a].workerId === worker.address).length === 0;
            };
            const workerSelector = (worker : Worker) : boolean => notCaller(worker) && workerNotBusy(worker);
            try {
              const worker = await waitForConnectedWorker(
                message.streamId,
                workerSelector,
                message.maxWaitAttempts || 30,
                message.waitInterval || 1000,
                async (duration) => {
                  await router.broadcast({
                    stream: 'events',
                    partitionKey: message.streamId,
                    data: {
                      name: 'RoutingInProgressEvent',
                      duration,
                      streamId: message.streamId
                    }
                  });
                });
              if (worker.address === 'disconnected') {
                log(`Routing cancelled for disconnected interaction ${message.streamId}`)
              } else {
                await router.broadcast({
                  stream: 'events',
                  partitionKey: message.streamId,
                  data: {
                    name: 'RoutingCompleteEvent',
                    streamId: message.streamId,
                    endpoint: worker.address
                  }
                });
              }
            } catch (err) {
              log('Routing failed', err);
              await router.broadcast({
                stream: 'events',
                partitionKey: message.streamId,
                data: {
                  name: 'RoutingFailedEvent',
                  streamId: message.streamId
                }
              });
            }
          }
            break;
          case 'InteractionEndedEvent': {
            log(`Received InteractionEndedEvent for ${message.streamId}`);
            delete assignmentState[message.streamId];
          }
        }
      }
    },
    {
      stream: 'workers',
      messageHandler: async (message : any, header : MessageHeader) => {
        switch (message.name) {
          case 'UpdateWorkerRegistration':
            try {
              await workerService
                .updateWorkerRegistration(header.partitionKey, message.address, message.connected);
            } catch (err) {
              return {message: `Failed to update worker registration - ${err.message}`}
            }
            break;
          case 'GetWorkers':
            return {workers};
        }
        return {message: `Unknown message: ${message.name}`};
      }
    });

};

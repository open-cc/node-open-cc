import {EntityEvent} from 'ddd-es-node';

interface Worker {
  address : string;
  connected : boolean;
}

const workers : { [key : string] : Worker } = {};

const getConnectedWorker = (filter: (worker: Worker) => boolean) : Worker => {
  return Object.keys(workers)
    .map(id => workers[id])
    .filter(worker => worker.connected && filter(worker))[0];
};

const waitForConnectedWorker = (filter: (worker: Worker) => boolean, attempts: number, interval: number) : Promise<Worker> => {
  return new Promise<Worker>((resolve, reject) => {
    const check = () => {
      if (attempts === 0) {
        reject(new Error('Failed to find worker'));
      } else {
        const worker = getConnectedWorker(filter);
        if (worker) {
          resolve(worker);
        } else {
          attempts--;
          setTimeout(() => {
            check();
          }, interval);
        }
      }
    };
    check();
  });
};

export default ({router, log}) => {

  router.register('events', (message : EntityEvent) => {
    switch (message.name) {
      case 'CallInitiatedEvent': {
        log(`Routing interaction ${message.streamId}`, message);
        const notCaller = (worker: Worker): boolean => {
          return worker.address.indexOf(`/${(message as any).fromPhoneNumber}`) === -1;
        };
        waitForConnectedWorker(notCaller,30, 1000)
          .then(worker => {
            router.broadcast({
              stream: 'events',
              partitionKey: message.streamId,
              data: {
                name: 'RoutingCompleteEvent',
                streamId: message.streamId,
                endpoint: worker.address
              }
            });
          })
          .catch((err : Error) => {
            log('Routing failed', err);
            router.broadcast({
              stream: 'events',
              partitionKey: message.streamId,
              data: {
                name: 'RoutingFailedEvent',
                streamId: message.streamId
              }
            });
          });
        break;
      }
    }
  });

  router.register('workers', message => {
    switch (message.name) {
      case 'register':
        if (workers[message.address] === undefined) {
          log('Registering new worker', message);
          workers[message.address] = {
            address: message.address,
            connected: message.connected
          }
        } else if (workers[message.address].connected !== message.connected) {
          log('Updating worker state', message);
          workers[message.address].connected = message.connected;
        }
        break;
    }
  });

};

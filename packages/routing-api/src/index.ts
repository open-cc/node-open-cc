import {EntityEvent} from 'ddd-es-node';

export default ({router, log}) => {
  router.register('events', (message : EntityEvent) => {
    switch (message.name) {
      case 'CallInitiatedEvent': {
        log(`Routing interaction ${message.streamId}`, message);
        setTimeout(() => {
          router.broadcast({
            stream: 'events',
            partitionKey: message.streamId,
            data: {
              name: 'RoutingCompleteEvent',
              streamId: message.streamId,
              endpoint: 'SIP/1002'
            }
          });
        }, 1000);
        break;
      }
    }
  });
  router.register('workers', message => {
    switch (message.name) {
      case 'register':
        break;
      case 'setAvailability':
        break;
    }
  });
};

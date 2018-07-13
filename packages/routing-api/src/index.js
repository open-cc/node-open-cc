module.exports = router => {
    router.register('events', message => {
        console.log('Received message', JSON.stringify(message, null, 2));
        switch (message.event.name) {
            case 'CallInitiatedEvent':
            {
                console.log(`Routing interaction ${message.event.streamId}`, message);
                setTimeout(() => {
                    router.broadcast({
                        stream: 'events',
                        partitionKey: message.event.streamId,
                        event: {
                            name: 'RoutingCompleteEvent',
                            streamId: message.event.streamId,
                            endpoint: 'SIP/1002'
                        }
                    });
                }, 1000);
                break;
            }
        }
    });
};
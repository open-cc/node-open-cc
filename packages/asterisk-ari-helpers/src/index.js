const debug = require('debug');

module.exports = (ari, context) => {
    context = context || {};
    context.log = debug(context.id || 'asterisk-ari-helpers');
    return {
        originate: (endpointToDial, channel, opts) => {

            ari.start('bridge-dial', () => {});

            opts = opts || {};

            const dialed = ari.Channel();

            channel.on('StasisEnd', (event, channel) => {
                hangupDialed(context, channel, dialed);
            });

            dialed.on('ChannelDestroyed', (event, dialed) => {
                hangupOriginal(context, channel, dialed);
            });

            dialed.on('StasisStart', (event, dialed) => {
                joinMixingBridge(context, ari, channel, dialed, opts);
            });

            genericErrorHandler(handler => dialed.originate({
                endpoint: endpointToDial,
                app: 'bridge-dial',
                appArgs: 'dialed'
            }, handler));

        }
    }
};

// handler for original channel hanging up so we can gracefully hangup the
// other end
const hangupDialed = (context, channel, dialed) => {
    context.log(
        `Channel ${channel.name} left our application, hanging up dialed channel ${dialed.name}`);
    // hangup the other end
    dialed.hangup(() => {
        // ignore error since dialed channel could have hung up, causing the
        // original channel to exit Stasis
    });
};

// handler for the dialed channel hanging up so we can gracefully hangup the
// other end
const hangupOriginal = (context, channel, dialed) => {
    context.log(`Dialed channel ${dialed.name} has been hung up, hanging up channel ${channel.name}`);
    // hangup the other end
    channel.hangup(() => {
        // ignore error since original channel could have hung up, causing the
        // dialed channel to exit Stasis
    });
};

// handler for dialed channel entering Stasis
const joinMixingBridge = (context, ari, channel, dialed, opts) => {

    const bridge = ari.Bridge();

    dialed.on('StasisEnd', (event, dialed) => {
        dialedExit(context, dialed, bridge);
    });

    genericErrorHandler(handler => dialed.answer(handler), () => {
        if (opts.onAnswer) {
            opts.onAnswer();
        }
        context.log(`Dialed channel ${dialed.name} has answered`);
    });

    genericErrorHandler(handler => bridge.create({type: 'mixing'}, handler), (err, bridge) => {
        context.log(`Created bridge ${bridge.id}`);
        addChannelsToBridge(context, channel, dialed, bridge);
    });
};

// handler for the dialed channel leaving Stasis
const dialedExit = (context, dialed, bridge) => {
    context.log(
        `Dialed channel ${dialed.name} has left our application, destroying bridge ${bridge.id}`);
    genericErrorHandler(handler => bridge.destroy(handler));
};

// handler for new mixing bridge ready for channels to be added to it
const addChannelsToBridge = (context, channel, dialed, bridge) => {
    context.log(`Adding channel ${channel.name} and dialed channel ${dialed.name} to bridge ${bridge.id}`);
    genericErrorHandler(handler =>  bridge.addChannel({channel: [channel.id, dialed.id]}, handler));
};

const genericErrorHandler = (withHandler, success) => {
    withHandler(function() {
        const err = [].slice.call(arguments)[0];
        if(err) {
            throw err;
        }
        if (success) {
            success.apply(null, arguments);
        }
    });
};
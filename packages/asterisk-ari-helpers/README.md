# @open-cc/asterisk-ari-helpers

Provides helper functions to be used with [ari-client](https://www.npmjs.com/package/ari-client).

## Installation

```shell
npm install @open-cc/asterisk-ari-helpers --save
```

## Usage

```javascript
const ari = require('ari-client');
const helpers = require('@open-cc/asterisk-ari-helpers');

ari.connect('http://asterisk:8080', 'user', 'password', (err, client) => {
    client.on('StasisStart', (event, channel) => {
        helpers(client)
            .originate('SIP/1001', channel);
    });
});
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
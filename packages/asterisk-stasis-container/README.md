# @open-cc/asterisk-stasis-container

A nodejs container to help with building [Asterisk](https://wiki.asterisk.org/wiki/display/AST/Home) stasis applications.

## Installation

```shell
npm install @open-cc/asterisk-stasis-container --save
```

## Usage

```javascript
const stasis = require('@open-cc/asterisk-stasis-container');

stasis('http://asterisk-host:8888/', {
    auth: { username: 'yourARIUser', password: 'yourARIUserPassword' }
}).then(ari => {
  ari.start('your-stasis-app', (event, channel) => {
    ...
  });
});
```

## Asterisk Config

Configure your Asterisk dialplan to launch a stasis application using the [`Stasis`](https://wiki.asterisk.org/wiki/display/AST/Asterisk+15+Application_Stasis) dialplan function - e.g:
```
[default]
exten => _+1NXXXXXXXXX,1,NoOp()
same => n,Stasis(your-stasis-app-name)
same => n,Hangup()
```

Ensure that the http interface is enabled within your `http.conf` and you've set the bindaddr to a address which will be routable from your Stasis app:
```
enabled=yes
bindaddr=0.0.0.0
```

Enable the Asterisk REST Interface in `ari.conf` and define a user + password:
```
[general]
enabled=yes
pretty=yes

[yourARIUser]
type=user
read_only=no
password=yourARIUserPassword
```

## Debug Logs
Set the following environment variable to enable debug logging.
```shell
DEBUG=asterisk-stasis-container
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
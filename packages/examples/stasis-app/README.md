# @open-cc/asterisk-stasis-container stasis-app

This example configures an [Asterisk](https://wiki.asterisk.org/wiki/display/AST/Home) stasis app using [@open-cc/asterisk-stasis-container](../../asterisk-stasis-container/README.md).

# Usage

Start the Asterisk an stasis apps using docker-compose:

```shell
docker-compose up
```

Register to the asterisk instance using a SIP based device. This example is using [pjsua](http://www.pjsip.org/pjsua.htm):

```shell
pjsua \
    --id sip:1001@127.0.0.1 \
    --registrar sip:1001@127.0.0.1 \
    --realm '*' \
    --username 1001 \
    --password AsteriskSecret \
    --local-port=5061
```

Dial the following endpoint to be dropped into the stasis app:

```shell
sip:127.0.0.1
```
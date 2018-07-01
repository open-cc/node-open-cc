# stasis-app

This example configures an [Asterisk](https://wiki.asterisk.org/wiki/display/AST/Home) stasis app using [@open-cc/asterisk-stasis-container](../../asterisk-stasis-container/README.md).

# Usage

Start the Asterisk an stasis apps using docker-compose:

```shell
docker-compose up
```

Connect to the asterisk instance using a SIP based device. You can use [pjsua](http://www.pjsip.org/pjsua.htm) is a convenient CLI based device:

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
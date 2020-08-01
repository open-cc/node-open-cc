# open-cc

This repo contains npm packages which support integrations with VoIP components and platforms.

## Packages

* [`@open-cc/api-common`](packages/api-common) - Common api runtime
* [`@open-cc/asterisk`](packages/asterisk) - Asterisk docker image
* [`@open-cc/asterisk-agent`](packages/asterisk-agent) - Integration adapter for asterisk
* [`@open-cc/asterisk-ari-connector`](packages/asterisk-ari-connector) - A nodejs container to help with building [Asterisk](https://wiki.asterisk.org/wiki/display/AST/Home) stasis applications
* [`@open-cc/core-api`](packages/core-api) - A micro-service which handles routing and interactions.
* [`@open-cc/flow-agent`](packages/flow-agent) - Integration adapter for flows
* [`@open-cc/flow-processor`](packages/flow-processor) - Executable workflows from gliffy diagrams
* [`@open-cc/kamailio-agent`](packages/kamailio-agent) - Periodically broadcasts user location data from kamailio using [jsonrpcs over http](https://kamailio.org/docs/modules/5.1.x/modules/jsonrpcs.html#idm1029969612)
* [`@open-cc/kamailio-proxy`](packages/kamailio-proxy) - Kamailio docker image
* [`@open-cc/twilio-agent`](packages/twilio-agent) - Integration adapter for twilio

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
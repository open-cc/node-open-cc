# speech recognition
- https://community.asterisk.org/t/asterisk-15-jack-streams-speech-recognition-so-many-questions/72108/14

# misc
- https://github.com/pbxware/asterisk-sounds
- https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+REST+Data+Models
- https://wiki.asterisk.org/wiki/display/AST/ARI+and+Bridges%3A+Basic+Mixing+Bridges

# text to speech
- https://aminastaneh.net/2012-05-06/fun-with-command-line-sip.html

# pjsip + kamailio
- https://wiki.asterisk.org/wiki/display/AST/Migrating+from+chan_sip+to+res_pjsip
- https://github.com/dougbtv/docker-asterisk/blob/master/high-availability/itsp/sip.conf
- https://community.asterisk.org/t/pjsip-endpoint-for-kamailio-dispatcher/70433/7
- https://stackoverflow.com/questions/34243671/kamailio-403-not-relaying-when-default-port-changed
- https://www.sipwise.org/doc/mr7.5.4/spce/ar01s02.html
- https://www.kamailio.org/events/2017-AstriCon/dcm-kamailio-astricon-2017.pdf
- https://wiki.4psa.com/display/KB/How+to+debug+Asterisk+and+Kamailio
- https://github.com/os11k/dispatcher/blob/master/kamailio.cfg
- http://www.evaristesys.com/blog/server-side-nat-traversal-with-kamailio-the-definitive-guide/
- http://kb.asipto.com/asterisk:realtime:kamailio-4.0.x-asterisk-11.3.0-astdb

# twilio
- https://www.twilio.com/blog/multi-party-calls-voip-gsm-programmable-voice

# connecting
```shell script
pjsua --id sip:1001@$(ipconfig getifaddr en0) --username 1001 --local-port=5061 --app-log-level 3
pjsua --id sip:1002@192.168.188.110 --registrar sip:192.168.188.110 --username 1002 --local-port=5062 --app-log-level 3
./play-sound.sh 1002
```

# start twilio example
```shell script
./dc.sh nats core ngrok twilio - up --build
curl -s -H 'Content-Type: application/json' -X POST http://localhost:8080/api/broadcast/workers -d '{ "name": "UpdateWorkerRegistration", "registrations": [{ "connected": true, "workerId": "1002", "address": "PSTN/+15555555555" }]}'
```
# apis
```shell script
curl -s -H 'Content-Type: application/json' -X POST http://localhost:8080/api/broadcast/workers -d '{"name":"get_workers"}' | jq
curl -s -H 'content-type: application/json' -X POST http://localhost:8080/api/broadcast/interactions --data '{"name":"get"}' | jq

curl -s -H 'Content-Type: application/json' -X POST http://192.168.188.110:8080/api/broadcast/workers -d '{"name":"get_workers"}' | jq
curl -s -H 'Content-Type: application/json' -X POST http://192.168.188.110:8080/api/broadcast/workers -d '{"name":"get_worker_address","workerId":"1002"}'
curl -s -H 'Content-Type: application/json' -X POST http://192.168.188.110:8080/api/broadcast/workers -d '{ "name": "UpdateWorkerRegistration", "registrations": [{ "connected": true, "workerId": "1002", "address": "SIP/cluster/123" }]}'
curl -s -H 'content-type: application/json' -X POST http://192.168.188.110:8080/api/broadcast/interactions --data '{"name":"get"}' | jq
curl -s -H 'content-type: application/json' -X POST http://192.168.188.110:8080/api/interactions/CAde58c2e007cb8789334aa81d293592fd --data '{"name":"ExternalInteractionInitiatedEvent","interactionId":"CAde58c2e007cb8789334aa81d293592fd","channel":"voice"}' | jq
```

# todo
- [x] create bridge api for kamailio which updates registered users
- [x] review if there are any hacks in kamailio config or routing logic
- [x] create kamailio-proxy dockerfile
- [x] add mechanism to update cluster friend config in sip.conf
- [x] determine which things should be externally configured in asterisk - e.g. certain ari.conf settings
- [x] external configuration of rtp ports
- [x] cleanup dispatcher list setup so it handles if kamailio restarted
- [x] cleanup dispatcher list setup so it detects dead destinations
- [x] integrate logic from example-stasis-app as generic capability
- [x] make flow-processor adapter service generic
- [x] create separate compose for core apis
- [x] implement twiml flow processor
- [ ] handle aggregate node stickiness/affinity - options:
    - get connections from http://localhost:8222/connz?subs=1 on nats server
    - hashring
    - or lifecycle subscriptions bound to ${entity-type}-{entity-id}
- [ ] re-design model for routes
- [ ] kamailio-agent will not advertise workers to restarted router-api because it thinks its already registered 
- [ ] add app level error handling for nats replys if listener has an error
- [ ] handle requests and delayed registration - e.g. calling get_workers before worker apis registered
- [ ] auto-register twilio trunk + number
    - [ ]  auto-ngrok setup for local dev env
- [ ] terraform provisioning and scaling controller
- [ ] integrate lets encrypt
- [ ] fix stale message nodes causing timeouts
    - [ ] set timeouts and mark instances as down
    - [ ] failover to other instances
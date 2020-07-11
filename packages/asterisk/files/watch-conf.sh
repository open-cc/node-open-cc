#!/usr/bin/env sh

function log() {
  echo "[${SCRIPT_NAME} $(date "+%Y%m%d-%H%M%S")] $@" | tee -a /watch-conf.log
}

function run() {
  cd /etc/asterisk
  if [[ -f "sip.conf.base" ]]; then
    cp sip.conf.base sip.conf
  fi
  log "Using SIP_PROXY_IPV4: ${SIP_PROXY_IPV4}"
  count=0
  if [[ -n "${SIP_PROXY_IPV4}" ]]; then
    echo >> sip.conf
  fi
  for host in ${SIP_PROXY_IPV4}; do
    log "Configuring [cluster${count}] with ${host}"
    echo "
[cluster${count}]
nat=force_rport,comedia
type=friend
context=default
host=${host}
insecure=invite
disallow=all
allow=ulaw" >> sip.conf
    count=$((count+1))
  done
  log "started"
  inotifywait -e close_write,moved_to,create -m $PWD |
  while read -r directory events filename; do
    log ${directory} ${events} ${filename}
    if [[ "${filename}" = "sip.conf" ]]; then
      asterisk -rx "sip reload"
    fi
  done
}

SCRIPT_NAME="$(basename ${0})"
run
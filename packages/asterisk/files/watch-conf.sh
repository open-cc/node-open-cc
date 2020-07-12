#!/usr/bin/env sh

function log() {
  echo "[${SCRIPT_NAME} $(date "+%Y%m%d-%H%M%S")] $@" | tee -a /watch-conf.log
}

function set_conf_var() {
  CONF_PATH="/etc/asterisk/${1}"
  CONF_VAR="${2}"
  CONF_VAL="${3}"
  CONF_DATA=$(cat ${CONF_PATH} | sed 's|${'${CONF_VAR}'}|'${CONF_VAL}'|g')
  echo "${CONF_DATA}" > ${CONF_PATH}
}

function configure_ari() {
  if [[ -n "${ARI_PASSWORD}" ]]; then
    log "Configuring ari.conf"
    set_conf_var ari.conf ARI_PASSWORD ${ARI_PASSWORD}
  fi
}

function configure_rtp() {
  log "Configuring rtp.conf"
  RTP_START=10001
  RTP_END=10100
  RTP_CONF=$(cat ari.conf | sed 's|${ARI_PASSWORD}|'${ARI_PASSWORD}'|g')
  if [[ -n "${RTP_PORTS}" ]]; then
    RTP_START=$(echo "${RTP_PORTS}" | awk -F'-' '{print $1}')
    RTP_END=$(echo "${RTP_PORTS}" | awk -F'-' '{print $2}')
  fi
  set_conf_var rtp.conf RTP_START ${RTP_START}
  set_conf_var rtp.conf RTP_END ${RTP_END}
}

function configure_sip_proxy_friends() {
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
}

function watch_for_changes() {
  inotifywait -e close_write,moved_to,create -m $PWD |
  while read -r directory events filename; do
    log ${directory} ${events} ${filename}
    if [[ "${filename}" = "sip.conf" ]]; then
      asterisk -rx "sip reload"
    fi
  done
}

function run() {
  log "Started"
  cd /etc/asterisk
  if [[ -f "sip.conf.base" ]]; then
    cp sip.conf.base sip.conf
  fi
  configure_ari
  configure_rtp
  configure_sip_proxy_friends
  watch_for_changes
}

SCRIPT_NAME="$(basename ${0})"
run
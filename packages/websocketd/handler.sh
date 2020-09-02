#!/usr/bin/env bash

CORE_API_URL=$1
NATS_SERVER=$2
ID=$RANDOM
LOG=/tmp/${ID}.log
PIDS=/tmp/${ID}.pids
rm -f /tmp/latest
ln -s ${LOG} /tmp/latest

touch ${LOG}

function log() {
  >&2 echo "[$(date '+%m/%d/%Y %H:%M:%S') ($ID)] $@"
}

function cleanup() {
  rm -f ${LOG}
  local l_pids;
  local l_pid;
  if [[ -f ${PIDS} ]]; then
    for l_pid in $(cat ${PIDS} | tr '\n' ' '); do
      log "Killing ${l_pid}"
      kill -9 $l_pid
    done
    rm -r ${PIDS}
  fi
}

function createSubscription() {
  while read line; do
    echo "$line" | grep 'Received a' | sed -E 's/.*Received a message: (.*)/\1/g'
  done < <( nats --server ${NATS_SERVER} sub events-broadcast 2>&1 & echo $! >> ${PIDS} )
}

function handleRequest() {
  line=$1
  echo "the line:$line:"
  local l_mode=$(echo "$line" | jq -r '.mode | select (.!=null)')
  local l_subject=$(echo "$line" | jq -r '.subject | select (.!=null)')
  local l_partition_key=$(echo "$line" | jq -r '.partitionKey | select (.!=null)')
  local l_message=$(echo "$line" | jq -c 'del(.subject,.mode)')
  if [[ -n "${l_subject}" ]] && [[ -n "${l_message}" ]]; then
    if [[ "${l_mode}" == "broadcast" ]]; then
      curl -s -H 'Content-Type: application/json' "${CORE_API_URL}/api/${l_mode}/${l_subject}" -d ${l_message} | jq -c .
    else
      curl -s -H 'Content-Type: application/json' "${CORE_API_URL}/api/${l_subject}/${l_partition_key}" -d ${l_message} | jq -c .
    fi
  fi
}

function processResponses() {
  while read line; do
    if [[ -n "$line" ]]; then
      echo "$line"
    fi
  done < <( tail -f ${LOG} & echo $! >> ${PIDS} )
}

trap "cleanup" SIGINT EXIT

processResponses &

createSubscription &

while read line; do
  if [[ -n "$line" ]]; then
    handleRequest "$line" >> ${LOG} &
  fi
done < /dev/stdin

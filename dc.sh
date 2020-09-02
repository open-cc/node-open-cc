#!/usr/bin/env bash

function cleanup() {
  echo $NGROK_CID
  if [[ -n "${NGROK_CID}" ]]; then
    >&2 echo "Stopping ${NGROK_CID}"
    docker stop ${NGROK_CID}
    NGROK_CID=""
  fi
  exit
}

trap cleanup exit INT TERM

function loadConf() {
  CONF_FILE="${1}"
  for BASE_DIR in $(echo "${HOME} ."); do
    if [[ -f "${BASE_DIR}/${CONF_FILE}" ]]; then
      source "${BASE_DIR}/${CONF_FILE}"
    fi
  done
}

loadConf ".dcrc"
loadConf ".secrets"

if [[ -n "${CWD}" ]]; then
  cd "${CWD}"
fi

if [[ -z "${PRIVATE_IPV4}" ]]; then
  export PRIVATE_IPV4=host.docker.internal
fi

if [[ -z "${COMPOSE_ARGS}" ]]; then
  COMPOSE_ARGS=""
  while [[ -n "$1" ]] && [[ "$1" != "-" ]]; do
    ROLE=$(echo "${1}" | tr '[:lower:]' '[:upper:]')
    if [[ "${ROLE}" == "NGROK" ]]; then
      RUN_NGROK=true
    else
      ROLE_PRIVATE_IPV4="${ROLE}_PRIVATE_IPV4"
      if [[ -z "${!ROLE_PRIVATE_IPV4}" ]]; then
        eval export "${ROLE_PRIVATE_IPV4}=host.docker.internal"
      fi
      FILE="docker-compose.${1}.yml"
      if [[ ! -f "${FILE}" ]]; then
        >&2 echo "${FILE} not found"
        exit 1
      fi
      COMPOSE_ARGS="${COMPOSE_ARGS} -f ${FILE}"
    fi
    shift
  done
  shift
fi

if [[ "${RUN_NGROK}" == "true" ]] && [[ "${1}" == "up" ]]; then
  NGROK_CID=$(docker run --rm \
    -d \
    -p 4040:4040 \
    -p 5000:5000 \
    -e NGROK_PORT="${NGROK_TARGET_IPV4:-host.docker.internal}:${NGROK_TARGET_PORT:-9999}" \
    wernight/ngrok)
  PUBLIC_URL=""
  while [[ -z "${PUBLIC_URL}" ]]; do
    PUBLIC_URL=$(curl -s "$(docker port ${NGROK_CID} 4040)/api/tunnels" | jq -r '.tunnels[0].public_url | select (.!=null)')
    sleep 1
  done
  >&2 echo "ngrok public url: ${PUBLIC_URL}"
  export PUBLIC_URL
fi

if [[ -z "${DEBUG}" ]]; then
  export DEBUG='*,-meshage*,-*nats-monitor*,-*DestinationReported*-'
fi

if [[ -n "${COMPOSE_ARGS}" ]]; then
  docker-compose ${COMPOSE_ARGS} config > .dc
fi

docker-compose -f .dc $@
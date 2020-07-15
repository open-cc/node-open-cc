#!/usr/bin/env bash

SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

if [[ -z "${HOST_DOCKER_INTERNAL}" ]]; then
  export HOST_DOCKER_INTERNAL=$(ip r | grep default | awk '{print $3}');
fi
if [[ -z "${HOSTS_HOSTNAME}" ]]; then
  export HOSTS_HOSTNAME="${HOST_DOCKER_INTERNAL}"
fi

${SCRIPTPATH}/node_modules/.bin/ts-node --project ${SCRIPTPATH}/docker-tsconfig.json ${SCRIPTPATH}/packages/api-common/src/server-run.ts
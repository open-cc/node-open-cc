#!/usr/bin/env bash

SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

export HOST_DOCKER_INTERNAL=$(ip r | grep default | awk '{print $3}');

${SCRIPTPATH}/node_modules/.bin/ts-node --project ${SCRIPTPATH}/docker-tsconfig.json ${SCRIPTPATH}/packages/api-common/src/server.ts
#!/usr/bin/env bash

USER=${1:-1002}

if [[ ! -f "sound.scratch.wav" ]]; then
  curl -o sound.scratch.wav https://ia802305.us.archive.org/19/items/Mozart3rdMovement/mozart3rdmovement.wav
fi

pjsua --id sip:${USER}@192.168.188.110 \
  --registrar sip:192.168.188.110 \
  --local-port=5062 \
  --null-audio \
  --auto-play \
  --play-file ./sound.scratch.wav
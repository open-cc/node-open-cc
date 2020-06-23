#!/usr/bin/env sh

if [[ -n "$(ls /tmp/asterisk-moh-pipe.*)" ]]; then
  rm /tmp/asterisk-moh-pipe.*
fi

PIPE="/tmp/asterisk-moh-pipe.$$"
mknod $PIPE p

mplayer ${MOH_STREAM:-http://146.71.124.10:8100/stream} -really-quiet -quiet -ao pcm:file=$PIPE -af resample=8000,channels=1,format=mulaw 2>/tmp/mplayer.log | cat $PIPE 2>/tmp/mplayerpipe.log
rm $PIPE
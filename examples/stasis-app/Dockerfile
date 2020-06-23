FROM andrius/asterisk:alpine_glibc-16.3.0
RUN apk add mplayer
COPY moh.sh /usr/sbin/moh.sh
RUN chmod +x /usr/sbin/moh.sh
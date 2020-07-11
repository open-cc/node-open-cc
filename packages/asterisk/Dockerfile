FROM andrius/asterisk:alpine_glibc-16.3.0

RUN apk --update upgrade \
    && apk add --update \
    curl \
    g++ \
    inotify-tools \
    make \
    mplayer \
    && rm -rf /var/cache/apk/*

COPY files/etc/asterisk/ari.conf /etc/asterisk/ari.conf
COPY files/etc/asterisk/extensions.conf /etc/asterisk/extensions.conf
COPY files/etc/asterisk/http.conf /etc/asterisk/http.conf
COPY files/etc/asterisk/modules.conf /etc/asterisk/modules.conf
COPY files/etc/asterisk/musiconhold.conf /etc/asterisk/musiconhold.conf
COPY files/etc/asterisk/rtp.conf /etc/asterisk/rtp.conf
COPY files/etc/asterisk/sip.conf /etc/asterisk/sip.conf

COPY files/moh.sh /usr/sbin/moh.sh
RUN chmod +x /usr/sbin/moh.sh

COPY files/watch-conf.sh /usr/sbin/watch-conf.sh
RUN chmod +x /usr/sbin/watch-conf.sh

RUN sed -i 's|exec \${COMMAND}|/usr/sbin/watch-conf.sh \&\nexec \${COMMAND}|' /docker-entrypoint.sh
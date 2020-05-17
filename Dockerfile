FROM node:lts-slim
WORKDIR /opt/app

RUN apt-get update && apt-get install -y \
    iproute2 \
    curl \
 && rm -rf /var/lib/apt/lists/*

ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

COPY ./package.json .
RUN npm install --unsafe-perm

COPY ./lerna.json .
COPY ./packages/api-common/package.json ./packages/api-common/
COPY ./examples/stasis-app/package.json ./examples/stasis-app/
COPY ./packages/asterisk-stasis-container/package.json ./packages/asterisk-stasis-container/
COPY ./packages/core-api/package.json ./packages/core-api/
RUN npm run lerna:bootstrap

COPY . .
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["/tini", "--"]
CMD ["/opt/app/docker-entrypoint.sh"]
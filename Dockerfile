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
COPY ./examples/flow/package.json ./examples/flow/
COPY ./packages/asterisk-agent/package.json ./packages/asterisk-agent/
COPY ./packages/asterisk-ari-connector/package.json ./packages/asterisk-ari-connector/
COPY ./packages/core-api/package.json ./packages/core-api/
COPY ./packages/flow-processor/package.json ./packages/flow-processor/
RUN npm run lerna:bootstrap

COPY . .
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["/tini", "--"]
CMD ["/opt/app/docker-entrypoint.sh"]
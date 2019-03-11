FROM node:latest
WORKDIR /opt/app
COPY . /opt/app
RUN apt-get update && apt-get -y install rsync
RUN npm install --unsafe-perm && \
    npm run lerna:bootstrap && \
    npm run build
CMD ["bash", "-c", "if [ -d /opt/dev ]; then rsync -av --progress /opt/dev/packages/ /opt/app/packages/ --exclude node_modules; rsync -av --progress /opt/dev/examples/ /opt/app/examples/ --exclude node_modules; fi; node /opt/app/packages/api-container/dist/src/index.js"]
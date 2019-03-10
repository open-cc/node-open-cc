FROM node:latest
WORKDIR /opt/app
COPY . /opt/app
RUN npm install --unsafe-perm && \
    npm run lerna:bootstrap && \
    npm run build
CMD ["node", "./packages/api-container/dist/src/index.js"]
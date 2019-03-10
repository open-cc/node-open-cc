FROM node:latest
WORKDIR /opt/app
ADD . /opt/app
RUN npm install --unsafe-perm
RUN npm run -s lerna:bootstrap
ENV SERVICES="/opt/service"
CMD ["node", "./packages/api-container/dist/src/index.js"]
const meshage = require('meshage');
const es = require('ddd-es-node');
const services = (process.env.SERVICES || '').split(/,/);
const clusterPort = process.env.CLUSTER_PORT || 9742;
const seeds = (process.env.SEEDS || '').split(/,/);
const apiPort = process.env.API_PORT || 8080;

meshage
    .init(new meshage.GrapevineCluster(clusterPort, seeds), apiPort)
    .start((err, router) => {
        services.forEach(service => {
            require(service)(router, es);
        });
    });
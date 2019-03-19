import {
  Stasis,
  StasisAppHandler,
  StasisAppRegistration,
  StasisConnectedHandler,
  StasisContainerConfig
} from './interfaces';
import * as ari from 'ari-client';
import * as debug from 'debug';

const log : debug.Debugger = debug('asterisk-stasis-container');

const stasisHandlers : { [id : string] : StasisAppRegistration } = {};

export class ARIInitializer {
  constructor(private ariConnector : ari.ARIConnector, private fetchInstance : typeof fetch) {
  }

  public connect(config : StasisContainerConfig, onConnected : StasisConnectedHandler) : void {
    config.log = config.log || log;
    config.log(`Connect requested to ${config.url}`);
    config.maxConnectAttempts = config.maxConnectAttempts || 30;
    config.connectAttemptInterval = config.connectAttemptInterval || 1000;
    new Promise<ari.ARI>((
      resolve : (ari : ari.ARI) => void,
      reject : (error : Error) => void) => {
      const init = (attempt : number = 0) => {
        config.log(`Attempting to connect to ${config.url} [${attempt} of ${config.maxConnectAttempts}]`);

        const fail = (err : Error) => {
          if (config.maxConnectAttempts === attempt) {
            reject(err);
          } else {
            setTimeout(() => {
              init(attempt + 1)
            }, config.connectAttemptInterval);
          }
        };

        this.fetchInstance(`${config.url}/ari/asterisk/info`, {
          method: 'GET',
          headers: {
            'Authorization': `basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
          }
        }).then(res => {
          if (res.ok) {
            this.ariConnector.connect(
              config.url,
              config.username,
              config.password, (err : Error, ari : ari.ARI) => {
                if (err) {
                  reject(err);
                } else {
                  config.log(`Connected to ${config.url}`);
                  resolve(ari);
                }
              });
          } else {
            fail(new Error(`${res.status} ${res.statusText}`));
          }
        }).catch(fail);
      };
      init();
    }).then((ariInstance : ari.ARI) => {
      const apps : StasisAppRegistration[] = toArray(onConnected(ariInstance));
      apps.forEach((app : StasisAppRegistration) => {
        ariInstance.start(app.id);
        stasisHandlers[app.id] = app;
      });
      ariInstance.on('StasisStart', (event : any, channel : any) => {
        config.log('Stasis app started', event);
        const app : StasisAppRegistration = stasisHandlers[event.application];
        if (app) {
          app.handler(event, channel);
        }
      });
    });
  }
}

const toArray = (appRegistration : StasisAppRegistration | StasisAppRegistration[]) : StasisAppRegistration[] => {
  return Array.isArray(appRegistration) ? appRegistration : [appRegistration];
};

const stasis : Stasis = (config : StasisContainerConfig, onConnected : StasisConnectedHandler) : void => {
  new ARIInitializer(ari, fetch).connect(config, onConnected);
};

export const stasisApp = (id : string, handler : StasisAppHandler) : StasisAppRegistration => {
  return {id, handler};
};

export default stasis;

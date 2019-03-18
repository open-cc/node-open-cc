import {
  Stasis,
  StasisAppRegistration,
  StasisConnected,
  StasisContainerConfig
} from './interfaces';
import * as ari from 'ari-client';
import * as debug from 'debug';
import superagent = require('superagent');

const log : debug.Debugger = debug('asterisk-stasis-container');

const stasisHandlers : { [id : string] : StasisAppRegistration } = {};

export class ARIInitializer {
  constructor(private ariConnector : ari.ARIConnector, private sa : superagent.SuperAgent<any>) {
  }

  public connect(config : StasisContainerConfig) : StasisConnected {
    let initializedAri : ari.ARI;
    const earlyRegistrations: string[] = [];
    config.log = config.log || log;
    config.log(`Connect requested to ${config.url}`);
    const connected : StasisConnected = {
      register: (id : string, app : StasisAppRegistration) : void => {
        config.log('Registering handler', id);
        stasisHandlers[id] = app;
        if (initializedAri) {
          initializedAri.start(id);
        } else {
          earlyRegistrations.push(id);
        }
      }
    };
    config.maxConnectAttempts = config.maxConnectAttempts || 30;
    config.connectAttemptInterval = config.connectAttemptInterval || 1000;
    new Promise<ari.ARI>((
      resolve : (ari : ari.ARI) => void,
      reject : (error : Error) => void) => {
      const init = (attempt : number = 0) => {
        config.log(`Attempting to connect to ${config.url} [${attempt} of ${config.maxConnectAttempts}]`);
        this.sa
          .get(`${config.url}/ari/asterisk/info`)
          .auth(config.username, config.password)
          .then(() => {
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
          })
          .catch((err : Error) => {
            if (config.maxConnectAttempts === attempt) {
              reject(err);
            } else {
              setTimeout(() => {
                init(attempt + 1)
              }, config.connectAttemptInterval);
            }
          });
      };
      init();
    }).then((ariInstance : ari.ARI) => {
      initializedAri = ariInstance;
      while (earlyRegistrations.length > 0) {
        ariInstance.start(earlyRegistrations.pop());
      }
      ariInstance.on('StasisStart', (event : any, channel : any) => {
        config.log('Stasis app started', event);
        const handler : StasisAppRegistration = stasisHandlers[event.application];
        if (handler) {
          handler(ariInstance)(event, channel);
        }
      });
    });
    return connected;
  }
}

const stasis : Stasis = (config : StasisContainerConfig) : StasisConnected => {
  return new ARIInitializer(ari, superagent).connect(config);
};

export default stasis;

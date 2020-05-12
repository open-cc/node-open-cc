import * as Ari from 'ari-client';
import * as debug from 'debug';
import fetch from 'node-fetch';
import {
  StasisAppHandler,
  StasisContainerConfig,
  StasisConnection
} from './core/interfaces';
import {StasisStart} from "ari-client";

export * from './core/interfaces';

export * from './core/actions';

const log : debug.Debugger = debug('asterisk-stasis-container');

const stasisAppHandlers : { [id : string] : StasisAppHandler } = {};

export async function stasisConnect(config : StasisContainerConfig) : Promise<StasisConnection> {
  config.fetch = config.fetch || fetch;
  config.log = config.log || log;
  config.ariModule = config.ariModule || Ari;
  config.log(`Connect requested to ${config.url}`);
  config.maxConnectAttempts = config.maxConnectAttempts || 30;
  config.connectAttemptInterval = config.connectAttemptInterval || 1000;
  return new Promise<StasisConnection>((
    resolve : (ari : StasisConnection) => void,
    reject : (error : Error) => void) => {
    const init = (attempt : number = 0) => {
      config.log(`Attempting to connect to ${config.url} [${attempt} of ${config.maxConnectAttempts}]`);
      const fail = (err : Error) => {
        log(err.message);
        if (config.maxConnectAttempts === attempt) {
          reject(err);
        } else {
          setTimeout(() => {
            init(attempt + 1)
          }, config.connectAttemptInterval);
        }
      };
      config.fetch(`${config.url}/ari/asterisk/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
        }
      }).then(res => {
        if (res.ok) {
          config.ariModule.connect(
            config.url,
            config.username,
            config.password, (err : Error, ari : Ari.Client) => {
              if (err) {
                reject(err);
              } else {
                config.log(`Connected to ${config.url}`);
                const stasisConnection : StasisConnection = {
                  ari,
                  registerStasisApp: (id : string, handler : StasisAppHandler) => {
                    stasisAppHandlers[id] = handler;
                    ari.start(id);
                    ari.on('StasisStart', (event : StasisStart, channel : any) => {
                      config.log('Stasis app started', event);
                      if (stasisAppHandlers[event.application]) {
                        stasisAppHandlers[event.application](event, channel);
                      }
                    });
                  }
                };
                resolve(stasisConnection);
              }
            });
        } else {
          fail(new Error(`${res.status} ${res.statusText}`));
        }
      }).catch(fail);
    };
    init();
  })
}

import * as ari from 'ari-client';
import { IDebugger } from 'debug';

export interface StasisContainerConfig {
  url : string;
  username : string;
  password : string;
  maxConnectAttempts? : number;
  connectAttemptInterval? : number;
  log?: IDebugger;
}

export interface StasisAppRegistration {
  (ari: ari.ARI): (event?: any, channel?: ari.Channel) => void;
}

export interface StasisConnected {
  register(id: string, app: StasisAppRegistration)
}

export interface Stasis {
  (config: StasisContainerConfig): StasisConnected;
}

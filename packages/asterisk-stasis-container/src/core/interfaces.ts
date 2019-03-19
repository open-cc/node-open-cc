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

export interface StasisAppHandler {
  (event?: any, channel?: ari.Channel): void;
}

export interface StasisAppRegistration {
  id: string,
  handler: StasisAppHandler
}

export interface StasisConnectedHandler {
  (ari: ari.ARI): StasisAppRegistration | StasisAppRegistration[];
}

export interface Stasis {
  (config: StasisContainerConfig, handler: StasisConnectedHandler): void;
}

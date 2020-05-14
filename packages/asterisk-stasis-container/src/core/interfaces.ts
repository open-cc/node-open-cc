import * as Ari from 'ari-client';
import { IDebugger } from 'debug';
import fetch from 'node-fetch';

export interface StasisContainerConfig {
  url : string;
  username : string;
  password : string;
  ariModule? : typeof Ari;
  maxConnectAttempts? : number;
  connectAttemptInterval? : number;
  log?: IDebugger;
  fetch? : typeof fetch;
}

export interface StasisAppHandler {
  (event?: any, channel?: Ari.Channel): void;
}

export interface StasisConnection {
  asteriskId: string,
  ari: Ari.Client,
  registerStasisApp(id: string, handler: StasisAppHandler)
}

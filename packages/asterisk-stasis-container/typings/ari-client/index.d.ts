import {EventEmitter} from 'events';

export function connect(url : string,
                        username : string,
                        password : string,
                        callback : (error : Error, ari : any) => void) : void;
export interface ARIConnector {
  connect(url : string,
          username : string,
          password : string,
          callback : (error : Error, ari : any) => void) : void
}
export interface ARI extends EventEmitter {
  start(app : string) : void;
}
export interface Channel extends EventEmitter {
}

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

export interface CallerID {
  name : string;
  number : string;
}

export interface DialplanCEP {
  priority : number;
  exten : string;
  context : string;
}

export interface Channel extends EventEmitter {
  id : string;
  accountcode : string;
  name : string;
  language : string;
  caller : CallerID;
  state : string;
  connected : CallerID;
  dialplan : DialplanCEP;
  answer(callback?: (err: Error) => void);
  hangup(callback?: (err: Error) => void);
}

export interface Endpoint {
  resource : string;
  state : string;
  technology : string;
  channel_ids : string[];
}

export interface EndpointQuery {
  resource? : string;
  tech? : string;
}

export interface Resource<Q, T> {
  list(callback? : ResourceCallback<T[]>) : void | Promise<T[]>;

  get(query? : Q | ResourceCallback<T>, callback? : ResourceCallback<T>) : void | Promise<T>;
}

export interface ResourceCallback<T> {
  (err : Error, t);
}

export interface ARI extends EventEmitter {
  start(app : string) : void;

  endpoints : Resource<EndpointQuery, Endpoint>;
  channels : Resource<any, Channel>;
}

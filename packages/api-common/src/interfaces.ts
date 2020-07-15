import {
  EntityRepository,
  EventBus
} from 'ddd-es-node';

export interface ApiDeps {
  stream(stream : string) : Stream;
  entityRepository : EntityRepository;
  eventBus : EventBus;
  shutdown(): Promise<void>;
}

export interface MessageHeader {
  stream: string;
  partitionKey?: string;
}

export interface Message extends MessageHeader {}


export interface MessageHandler<T> {
  (data? : T, header? : MessageHeader) : any;
}

export type ConstructorOf<T> = new (...args: any[]) => T;

export interface Stream {
  on<T>(name : (string | ConstructorOf<T>), handler : MessageHandler<T>) : Stream;

  broadcast<T>(message : any) : Promise<T[]>;

  send<T>(partitionKey: string, message : any) : Promise<T>;
}

export interface Api {
  (reg : ApiDeps) : void;
}


import {MessageHandler as MeshageMessageHandler} from 'meshage';
import {
  EntityRepository,
  EventBus
} from 'ddd-es-node';
import {
  MessageHeader
} from 'meshage/src/core/message';

export interface ApiDeps {
  stream(stream : string) : Stream;
  entityRepository : EntityRepository;
  eventBus : EventBus;
}

export {
  MessageHeader,
  ConnectedMessageRouter
} from 'meshage';

export interface MessageHandler<T> extends MeshageMessageHandler {
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


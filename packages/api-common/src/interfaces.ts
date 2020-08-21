import {
  EntityRepository,
  EventBus
} from 'ddd-es-node';

import {
  Subject
} from 'meshage';

export interface ApiDeps {
  subject(stream : string) : Subject;
  entityRepository : EntityRepository;
  eventBus : EventBus;
  shutdown(): Promise<void>;
}

export interface Api {
  (reg : ApiDeps) : void;
}

export {
  Subject,
  SubjectMessageHeader as MessageHeader,
  SubjectMessage as Message,
  HttpMessage,
  HttpMessageHeader
} from 'meshage';


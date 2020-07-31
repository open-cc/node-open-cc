import * as VoiceResponse from 'twilio/lib/twiml/VoiceResponse'

interface Say extends VoiceResponse.SayAttributes {
  message : string;
}

interface TwimlElementApplier {
  (voiceResponse : VoiceResponse, id : string, attributes : any);
}

interface TwimlElement {
  type : string;
  id : string;
  attributes : any;
  order : number;
}

interface TwimlElementById {
  [id : string] : TwimlElement
}

export class TwimlBuilder {
  private static TYPE_APPLIER : { [type : string] : TwimlElementApplier } = {
    conference(voiceResponse : VoiceResponse, id : string, attributes : VoiceResponse.ConferenceAttributes) {
      voiceResponse.dial().conference(attributes, id);
    },
    say(voiceResponse : VoiceResponse, id : string, say : Say) {
      const {message, ...attributes} = say;
      voiceResponse.say(attributes, message);
    }
  };

  private elements : { [type : string] : TwimlElementById } = {};

  public static create() : TwimlBuilder {
    return new TwimlBuilder();
  }

  public reset() {
    this.elements = {};
  }

  public conference(id : string, attributes? : VoiceResponse.ConferenceAttributes) : TwimlBuilder {
    return this.merge(id, 'conference', attributes);
  }

  public say(id : string, message : string, attributes? : VoiceResponse.SayAttributes) : TwimlBuilder {
    return this.merge(id, 'say', {...attributes, message});
  }

  public buildVoiceResponse() : VoiceResponse {
    const orderedElements : TwimlElement[] = Object.keys(this.elements).reduce((unorderedElements: TwimlElement[], elementType : string) => {
      unorderedElements.push(...Object.keys(this.elements[elementType]).map((elementId) => this.elements[elementType][elementId]));
      return unorderedElements;
    }, [])
      .sort((element1, element2) => {
        return element1.order - element2.order;
      });
    if (orderedElements.length === 0) {
      return null;
    }
    const voiceResponse : VoiceResponse = new VoiceResponse();
    for (const element of orderedElements) {
      TwimlBuilder.TYPE_APPLIER[element.type](voiceResponse, element.id, element.attributes);
    }
    return voiceResponse;
  }

  private merge(id : string, type : string, attributes : any) : TwimlBuilder {
    if (!this.elements[type]) {
      this.elements[type] = {};
    }
    let element : TwimlElement = this.elements[type][id];
    if (!element) {
      const order = Object.keys(this.elements)
        .map((elementType : string) => Object.keys(this.elements[elementType]).length)
        .reduce((sum, len) => sum + len) + 1;
      this.elements[type][id] = {
        id,
        type,
        order,
        attributes
      }
    } else {
      this.elements[type][id].attributes = {
        ...this.elements[type][id].attributes,
        ...attributes
      }
    }
    return this;
  }
}

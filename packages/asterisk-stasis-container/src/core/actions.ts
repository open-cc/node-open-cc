import * as Ari from 'ari-client';
import * as debug from 'debug';
import {ChannelLeftBridge} from "ari-client";

export interface AnswerHandler {
  (): Promise<void>;
}

export class Originate {

  constructor(private readonly ari : Ari.Client,
              private readonly logger : debug.IDebugger,
              private readonly endpoint : string,
              private readonly channel : Ari.Channel,
              private readonly onAnswer : AnswerHandler) {
  }

  public async execute() {

    const dialed = this.ari.Channel();

    this.channel.on('StasisEnd', async (event : Ari.StasisEnd, channel : Ari.Channel) => {
      await this.hangupDialed(channel, dialed);
    });

    dialed.on('ChannelDestroyed', async (event : Ari.ChannelDestroyed, dialed : Ari.Channel) => {
      await this.hangupOriginal(this.channel, dialed);
    });

    dialed.on('StasisStart', async (event: Ari.StasisStart, dialed : Ari.Channel) => {
      await this.joinMixingBridge(this.channel, dialed);
    });

    await dialed.originate({
      endpoint: this.endpoint,
      app: 'bridge-dial',
      appArgs: 'dialed'
    });

    this.ari.start('bridge-dial');
  }

  private async hangupDialed(channel : Ari.Channel, dialed : Ari.Channel) {
    // handler for original channel hanging up so we can gracefully hangup the
    // other end
    this.logger(`Channel ${channel.name} left our application, hanging up dialed channel ${dialed.name}`);
    try {
      await dialed.hangup();
    } catch (err) {
      this.logger(`Failed to hangup dialed channel ${dialed.name}`);
    }
  }

  private async hangupOriginal(channel : Ari.Channel, dialed : Ari.Channel) {
    // handler for dialed channel entering Stasis
    this.logger(`Dialed channel ${dialed.name} has been hung up, hanging up channel ${channel.name}`);
    try {
      await channel.hangup();
    } catch (err) {
      this.logger(`Failed to hangup channel ${channel.name}`);
    }
  }

  private async joinMixingBridge(channel : Ari.Channel, dialed : Ari.Channel) {

    const bridge = this.ari.Bridge();

    bridge.on('ChannelLeftBridge', async (event : Ari.ChannelLeftBridge, instances: ChannelLeftBridge) => {
      this.logger(
        `Channel ${instances.channel.name} has left the bridge, hanging up ${channel.name}`);
      try {
        await channel.hangup();
      } catch (err) {
        this.logger(`Failed to hang up channel ${channel.name}`);
      }
    });

    dialed.on('StasisEnd', async (event : Ari.StasisEnd, dialed) => {
      await this.dialedExit(dialed, bridge);
    });

    await dialed.answer();

    if (this.onAnswer) {
      await this.onAnswer();
    }

    this.logger(`Dialed channel ${dialed.name} has answered`);

    await bridge.create({type: 'mixing'});

    this.logger(`Created bridge ${bridge.id}`);

    await this.addChannelsToBridge(channel, dialed, bridge);

  }

  private async addChannelsToBridge(channel : Ari.Channel, dialed : Ari.Channel, bridge : Ari.Bridge) {
    this.logger(`Adding channel ${channel.name} and dialed channel ${dialed.name} to bridge ${bridge.id}`);
    await bridge.addChannel({channel: [channel.id, dialed.id]});
  }

  private async dialedExit(dialed : Ari.Channel, bridge : Ari.Bridge) {
    // handler for the dialed channel leaving Stasis
    this.logger(
      `Dialed channel ${dialed.name} has left our application, destroying bridge ${bridge.id}`);
    await bridge.destroy();
  }
}



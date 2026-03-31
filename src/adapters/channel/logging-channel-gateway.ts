import type { FastifyBaseLogger } from "fastify";

import type {
  ChannelGateway,
  SendChannelMessageInput,
  SendChannelPhotoInput
} from "../../engine/channel/channel-gateway.js";

export class LoggingChannelGateway implements ChannelGateway {
  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly channel: string
  ) {}

  async sendMessage(input: SendChannelMessageInput): Promise<string | null> {
    this.logger.info({ channel: this.channel, channelMessage: input }, "Channel sendMessage skipped");
    return null;
  }

  async sendPhoto(input: SendChannelPhotoInput): Promise<string | null> {
    this.logger.info({ channel: this.channel, channelPhoto: input }, "Channel sendPhoto skipped");
    return null;
  }

  async clearInlineKeyboard(input: { chatId: string; messageId: string }): Promise<void> {
    this.logger.info(
      { channel: this.channel, channelClearInlineKeyboard: input },
      "Channel clearInlineKeyboard skipped"
    );
  }

  async deleteMessage(input: { chatId: string; messageId: string }): Promise<void> {
    this.logger.info({ channel: this.channel, channelDeleteMessage: input }, "Channel deleteMessage skipped");
  }
}

import type { TelegramGateway } from "../../src/engine/telegram/telegram-gateway.js";

export type SentTelegramMessage = {
  chatId: string;
  photoPath?: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
  };
  text: string;
};

export class CapturingTelegramGateway implements TelegramGateway {
  readonly messages: SentTelegramMessage[] = [];
  readonly deletedMessageIds: string[] = [];
  readonly clearedInlineMessageIds: string[] = [];
  private seq = 1;

  async sendMessage(input: SentTelegramMessage): Promise<string | null> {
    this.messages.push(input);
    return String(this.seq++);
  }

  async sendPhoto(input: {
    chatId: string;
    photoPath: string;
    caption?: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
  }): Promise<string | null> {
    this.messages.push({
      chatId: input.chatId,
      photoPath: input.photoPath,
      replyMarkup: input.replyMarkup,
      text: input.caption ?? ""
    });
    return String(this.seq++);
  }

  async clearInlineKeyboard(input: { chatId: string; messageId: string }): Promise<void> {
    this.clearedInlineMessageIds.push(`${input.chatId}:${input.messageId}`);
  }

  async deleteMessage(input: { chatId: string; messageId: string }): Promise<void> {
    this.deletedMessageIds.push(`${input.chatId}:${input.messageId}`);
  }
}

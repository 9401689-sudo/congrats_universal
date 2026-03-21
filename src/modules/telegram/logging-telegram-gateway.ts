import type { FastifyBaseLogger } from "fastify";

import type { TelegramGateway } from "./telegram-gateway.js";

export class LoggingTelegramGateway implements TelegramGateway {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async sendMessage(input: {
    chatId: string;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
  }): Promise<string | null> {
    this.logger.info({ telegramMessage: input }, "Telegram sendMessage skipped");
    return null;
  }

  async sendPhoto(input: {
    chatId: string;
    photoPath: string;
    caption?: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
  }): Promise<string | null> {
    this.logger.info({ telegramPhoto: input }, "Telegram sendPhoto skipped");
    return null;
  }

  async clearInlineKeyboard(input: { chatId: string; messageId: string }): Promise<void> {
    this.logger.info({ telegramClearInlineKeyboard: input }, "Telegram clearInlineKeyboard skipped");
  }

  async deleteMessage(input: { chatId: string; messageId: string }): Promise<void> {
    this.logger.info({ telegramDeleteMessage: input }, "Telegram deleteMessage skipped");
  }
}

import { openAsBlob } from "node:fs";

import type { TelegramGateway } from "../../engine/telegram/telegram-gateway.js";

export class BotApiTelegramGateway implements TelegramGateway {
  private readonly apiToken: string;
  private readonly lastInlineMessageIdByChat = new Map<string, string>();

  constructor(botToken: string) {
    this.apiToken = botToken.replace(/^bot/, "");
  }

  async sendMessage(input: {
    chatId: string;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
  }): Promise<string | null> {
    await this.clearPreviousInlineKeyboard(input.chatId);
    const response = await fetch(
      `https://api.telegram.org/bot${this.apiToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: input.chatId,
          text: input.text,
          reply_markup: input.replyMarkup
        })
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram Bot API error: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as { result?: { message_id?: number } };
    const messageId =
      payload.result?.message_id != null ? String(payload.result.message_id) : null;

    this.rememberInlineMessage(input.chatId, messageId, Boolean(input.replyMarkup));
    return messageId;
  }

  async sendPhoto(input: {
    chatId: string;
    photoPath: string;
    caption?: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
  }): Promise<string | null> {
    await this.clearPreviousInlineKeyboard(input.chatId);
    const blob = await openAsBlob(input.photoPath);
    const form = new FormData();
    form.set("chat_id", input.chatId);
    form.set("photo", blob, input.photoPath.split(/[\\/]/).pop() ?? "preview.png");

    if (input.caption) {
      form.set("caption", input.caption);
    }
    if (input.replyMarkup) {
      form.set("reply_markup", JSON.stringify(input.replyMarkup));
    }

    const response = await fetch(`https://api.telegram.org/bot${this.apiToken}/sendPhoto`, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram Bot API sendPhoto error: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as { result?: { message_id?: number } };
    const messageId =
      payload.result?.message_id != null ? String(payload.result.message_id) : null;

    this.rememberInlineMessage(input.chatId, messageId, Boolean(input.replyMarkup));
    return messageId;
  }

  async clearInlineKeyboard(input: { chatId: string; messageId: string }): Promise<void> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.apiToken}/editMessageReplyMarkup`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: input.chatId,
          message_id: Number(input.messageId),
          reply_markup: { inline_keyboard: [] }
        })
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram Bot API editMessageReplyMarkup error: ${response.status} ${body}`);
    }

    const tracked = this.lastInlineMessageIdByChat.get(input.chatId);
    if (tracked === input.messageId) {
      this.lastInlineMessageIdByChat.delete(input.chatId);
    }
  }

  async deleteMessage(input: { chatId: string; messageId: string }): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.apiToken}/deleteMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: input.chatId,
        message_id: Number(input.messageId)
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram Bot API deleteMessage error: ${response.status} ${body}`);
    }

    const tracked = this.lastInlineMessageIdByChat.get(input.chatId);
    if (tracked === input.messageId) {
      this.lastInlineMessageIdByChat.delete(input.chatId);
    }
  }

  private async clearPreviousInlineKeyboard(chatId: string): Promise<void> {
    const previousMessageId = this.lastInlineMessageIdByChat.get(chatId);
    if (!previousMessageId) {
      return;
    }

    try {
      await this.clearInlineKeyboard({ chatId, messageId: previousMessageId });
    } catch {
      this.lastInlineMessageIdByChat.delete(chatId);
    }
  }

  private rememberInlineMessage(
    chatId: string,
    messageId: string | null,
    hasInlineKeyboard: boolean
  ): void {
    if (!messageId) {
      return;
    }

    if (hasInlineKeyboard) {
      this.lastInlineMessageIdByChat.set(chatId, messageId);
      return;
    }

    this.lastInlineMessageIdByChat.delete(chatId);
  }
}

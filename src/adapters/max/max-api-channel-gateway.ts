import { openAsBlob } from "node:fs";

import type {
  ChannelGateway,
  ChannelReplyMarkup,
  SendChannelMessageInput,
  SendChannelPhotoInput
} from "../../engine/channel/channel-gateway.js";

type MaxMessageResponse = {
  message?: {
    body?: {
      mid?: string;
    };
    message_id?: string;
  };
};

type MaxUploadUrlResponse = {
  url?: string;
};

type MaxUploadedMediaPayload = Record<string, unknown> & {
  token?: string;
};

export class MaxApiChannelGateway implements ChannelGateway {
  private readonly apiBaseUrl = "https://platform-api.max.ru";
  private readonly lastInlineMessageIdByChat = new Map<string, string>();
  private readonly token: string;

  constructor(botToken: string) {
    this.token = botToken;
  }

  async sendMessage(input: SendChannelMessageInput): Promise<string | null> {
    if (!input.preserveInlineKeyboard) {
      await this.clearPreviousInlineKeyboard(input.chatId);
    }

    const body = {
      text: input.text,
      attachments: this.buildKeyboardAttachments(input.replyMarkup)
    };

    const response = await fetch(this.buildMessagesUrl(input.chatId), {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify(body)
    });

    const payload = await this.expectJson<MaxMessageResponse>(response, "MAX sendMessage");
    const messageId = payload.message?.body?.mid ?? payload.message?.message_id ?? null;
    this.rememberInlineMessage(input.chatId, messageId, Boolean(input.replyMarkup));
    return messageId;
  }

  async sendPhoto(input: SendChannelPhotoInput): Promise<string | null> {
    await this.clearPreviousInlineKeyboard(input.chatId);
    const imagePayload = await this.uploadMedia(input.photoPath, "image");
    const attachments = [
      {
        type: "image",
        payload: imagePayload
      },
      ...this.buildKeyboardAttachments(input.replyMarkup)
    ];

    const response = await fetch(this.buildMessagesUrl(input.chatId), {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        text: input.caption ?? "",
        attachments
      })
    });

    const payload = await this.expectJson<MaxMessageResponse>(response, "MAX sendPhoto");
    const messageId = payload.message?.body?.mid ?? payload.message?.message_id ?? null;
    this.rememberInlineMessage(input.chatId, messageId, Boolean(input.replyMarkup));
    return messageId;
  }

  async clearInlineKeyboard(_input: { chatId: string; messageId: string }): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/messages?message_id=${encodeURIComponent(_input.messageId)}`,
      {
        method: "PUT",
        headers: this.jsonHeaders(),
        body: JSON.stringify({
          attachments: []
        })
      }
    );

    await this.expectJson<Record<string, unknown>>(response, "MAX clearInlineKeyboard");

    const tracked = this.lastInlineMessageIdByChat.get(_input.chatId);
    if (tracked === _input.messageId) {
      this.lastInlineMessageIdByChat.delete(_input.chatId);
    }
  }

  async deleteMessage(input: { chatId: string; messageId: string }): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/messages?message_id=${encodeURIComponent(input.messageId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: this.token
        }
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MAX deleteMessage failed: ${response.status} ${body}`);
    }

    const tracked = this.lastInlineMessageIdByChat.get(input.chatId);
    if (tracked === input.messageId) {
      this.lastInlineMessageIdByChat.delete(input.chatId);
    }
  }

  private async uploadMedia(
    filePath: string,
    type: "file" | "image"
  ): Promise<MaxUploadedMediaPayload> {
    const uploadUrlResponse = await fetch(`${this.apiBaseUrl}/uploads?type=${type}`, {
      method: "POST",
      headers: {
        Authorization: this.token
      }
    });

    const uploadUrlPayload = await this.expectJson<MaxUploadUrlResponse>(
      uploadUrlResponse,
      "MAX createUploadUrl"
    );
    if (!uploadUrlPayload.url) {
      throw new Error("MAX upload URL response did not contain url");
    }

    const blob = await openAsBlob(filePath);
    const form = new FormData();
    form.set("data", blob, filePath.split(/[\\/]/).pop() ?? "upload.bin");

    const uploadResponse = await fetch(uploadUrlPayload.url, {
      method: "POST",
      headers: {
        Authorization: this.token
      },
      body: form
    });

    return await this.expectJson<MaxUploadedMediaPayload>(uploadResponse, "MAX uploadMedia");
  }

  private buildMessagesUrl(userId: string): string {
    return `${this.apiBaseUrl}/messages?user_id=${encodeURIComponent(userId)}`;
  }

  private buildKeyboardAttachments(replyMarkup?: ChannelReplyMarkup): Array<Record<string, unknown>> {
    if (!replyMarkup?.inline_keyboard?.length) {
      return [];
    }

    return [
      {
        type: "inline_keyboard",
        payload: {
          buttons: replyMarkup.inline_keyboard.map((row) =>
            row.map((button) => {
              if (button.url) {
                return {
                  type: "link",
                  text: button.text,
                  url: button.url
                };
              }

              return {
                type: "callback",
                text: button.text,
                payload: button.callback_data ?? button.text
              };
            })
          )
        }
      }
    ];
  }

  private jsonHeaders(): Record<string, string> {
    return {
      Authorization: this.token,
      "Content-Type": "application/json"
    };
  }

  private async expectJson<T>(response: Response, label: string): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${label} failed: ${response.status} ${body}`);
    }

    return (await response.json()) as T;
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

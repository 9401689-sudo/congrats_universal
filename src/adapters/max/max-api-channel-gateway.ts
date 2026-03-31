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
  private readonly token: string;

  constructor(botToken: string) {
    this.token = botToken;
  }

  async sendMessage(input: SendChannelMessageInput): Promise<string | null> {
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
    return payload.message?.body?.mid ?? payload.message?.message_id ?? null;
  }

  async sendPhoto(input: SendChannelPhotoInput): Promise<string | null> {
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
    return payload.message?.body?.mid ?? payload.message?.message_id ?? null;
  }

  async clearInlineKeyboard(_input: { chatId: string; messageId: string }): Promise<void> {
    // MAX supports message editing, but our current engine does not keep enough original
    // message body state to safely rebuild non-keyboard attachments during edit.
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

  private buildMessagesUrl(chatId: string): string {
    return `${this.apiBaseUrl}/messages?chat_id=${encodeURIComponent(chatId)}`;
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
}

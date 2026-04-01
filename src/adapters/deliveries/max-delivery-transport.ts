import type { ChannelReplyMarkup } from "../../engine/channel/channel-gateway.js";
import { openAsBlob } from "node:fs";

import type { DeliveryTransport } from "../../engine/delivery/delivery-transport.js";

type MaxUploadUrlResponse = {
  url?: string;
};

type MaxUploadedMediaPayload = Record<string, unknown> & {
  token?: string;
};

type MaxMessageResponse = {
  message?: {
    body?: {
      mid?: string;
    };
    message_id?: string;
  };
};

export class MaxDeliveryTransport implements DeliveryTransport {
  private readonly apiBaseUrl = "https://platform-api.max.ru";

  constructor(private readonly token: string) {}

  async sendDocument(input: {
    caption: string;
    chatId: string;
    deliveryMethod?: "manual" | "username";
    fileId?: string;
    recipientUsername?: string | null;
    replyMarkup?: ChannelReplyMarkup;
    renderedPath?: string;
  }): Promise<{ fileId: string }> {
    const attachmentPayload = input.renderedPath
      ? await this.uploadMedia(input.renderedPath, "file")
      : input.fileId
        ? { token: input.fileId }
        : null;

    if (!attachmentPayload) {
      throw new Error("MaxDeliveryTransport requires fileId or renderedPath");
    }

    const response = await fetch(`${this.apiBaseUrl}/messages?user_id=${encodeURIComponent(input.chatId)}`, {
      method: "POST",
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: input.caption,
        attachments: [
          {
            type: "file",
            payload: attachmentPayload
          },
          ...this.buildKeyboardAttachments(
            input.replyMarkup ??
              (input.deliveryMethod === "username" && input.recipientUsername
                ? {
                    inline_keyboard: [
                      [
                        {
                          text: "Открыть чат получателя",
                          url: `https://max.ru/${input.recipientUsername.replace(/^@/, "")}`
                        }
                      ]
                    ]
                  }
                : undefined)
          )
        ]
      })
    });

    await this.expectJson<MaxMessageResponse>(response, "MAX sendDocument");
    return { fileId: input.fileId ?? attachmentPayload.token ?? `max_file_${Date.now()}` };
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

  private async expectJson<T>(response: Response, label: string): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${label} failed: ${response.status} ${body}`);
    }

    return (await response.json()) as T;
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
}

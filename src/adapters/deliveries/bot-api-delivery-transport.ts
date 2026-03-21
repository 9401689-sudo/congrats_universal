import { openAsBlob } from "node:fs";

import type { DeliveryTransport } from "../../engine/delivery/delivery-transport.js";

export class BotApiDeliveryTransport implements DeliveryTransport {
  private readonly apiToken: string;

  constructor(botToken: string) {
    this.apiToken = botToken.replace(/^bot/, "");
  }

  async sendDocument(input: {
    caption: string;
    chatId: string;
    fileId?: string;
    renderedPath?: string;
  }): Promise<{ fileId: string }> {
    const form = new FormData();
    form.set("chat_id", input.chatId);
    form.set("caption", input.caption);

    if (input.fileId) {
      form.set("document", input.fileId);
    } else if (input.renderedPath) {
      const blob = await openAsBlob(input.renderedPath);
      form.set("document", blob, input.renderedPath.split(/[\\/]/).pop() ?? "document.bin");
    } else {
      throw new Error("BotApiDeliveryTransport requires fileId or renderedPath");
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.apiToken}/sendDocument`,
      {
        method: "POST",
        body: form
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram sendDocument failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { document?: { file_id?: string } };
    };

    const fileId = payload.result?.document?.file_id;
    if (!payload.ok || !fileId) {
      throw new Error("Telegram sendDocument response missing file_id");
    }

    return { fileId };
  }
}

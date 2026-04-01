import type { FastifyBaseLogger } from "fastify";

import type { DeliveryTransport } from "../../engine/delivery/delivery-transport.js";

export class LoggingDeliveryTransport implements DeliveryTransport {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async sendDocument(input: {
    caption: string;
    chatId: string;
    deliveryMethod?: "manual" | "username";
    fileId?: string;
    recipientUsername?: string | null;
    replyMarkup?: { inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>> };
    renderedPath?: string;
  }): Promise<{ fileId: string }> {
    this.logger.info({ deliverySend: input }, "Delivery sendDocument skipped");
    return { fileId: input.fileId ?? `generated_${Date.now()}` };
  }
}

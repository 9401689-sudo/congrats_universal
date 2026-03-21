import type { FastifyBaseLogger } from "fastify";

import type { DeliveryTransport } from "./delivery-transport.js";

export class LoggingDeliveryTransport implements DeliveryTransport {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async sendDocument(input: {
    caption: string;
    chatId: string;
    fileId?: string;
    renderedPath?: string;
  }): Promise<{ fileId: string }> {
    this.logger.info({ deliverySend: input }, "Delivery sendDocument skipped");
    return { fileId: input.fileId ?? `generated_${Date.now()}` };
  }
}

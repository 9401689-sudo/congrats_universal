import type { ChannelReplyMarkup } from "../channel/channel-gateway.js";

export interface DeliveryTransport {
  sendDocument(input: {
    caption: string;
    chatId: string;
    deliveryMethod?: "manual" | "username";
    fileId?: string;
    recipientUsername?: string | null;
    replyMarkup?: ChannelReplyMarkup;
    renderedPath?: string;
  }): Promise<{ fileId: string }>;
}

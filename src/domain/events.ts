export type BotEventType =
  | "callback"
  | "chat_member"
  | "my_chat_member"
  | "pre_checkout"
  | "successful_payment"
  | "text"
  | "unknown";

export type NormalizedTelegramEvent = {
  botBlocked: boolean;
  botUnblocked: boolean;
  callbackData: string | null;
  callbackMessageId: string | null;
  callbackQueryId: string | null;
  chatId: string | null;
  chatType: string | null;
  currency: string | null;
  eventType: BotEventType;
  invoicePayload: string | null;
  isStart: boolean;
  messageId: string | null;
  providerPaymentChargeId: string | null;
  raw: unknown;
  text: string | null;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUserId: string | null;
  tgUsername: string | null;
  totalAmount: number | null;
  updateId: number | null;
};

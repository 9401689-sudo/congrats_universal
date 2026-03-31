export type ChannelEventType =
  | "callback"
  | "chat_member"
  | "my_chat_member"
  | "pre_checkout"
  | "successful_payment"
  | "text"
  | "unknown";

export type ChannelEvent = {
  botBlocked: boolean;
  botUnblocked: boolean;
  callbackData: string | null;
  callbackMessageId: string | null;
  callbackQueryId: string | null;
  channel: string;
  chatId: string | null;
  chatType: string | null;
  currency: string | null;
  eventType: ChannelEventType;
  invoicePayload: string | null;
  isStart: boolean;
  messageId: string | null;
  providerPaymentChargeId: string | null;
  raw: unknown;
  text: string | null;
  totalAmount: number | null;
  updateId: number | null;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUserId: string | null;
  tgUsername: string | null;
  userFirstName: string | null;
  userId: string | null;
  userLastName: string | null;
  username: string | null;
};

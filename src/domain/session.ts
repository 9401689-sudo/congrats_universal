export type AwaitingState =
  | "none"
  | "recipient_name"
  | "tz"
  | "delivery_username"
  | "email";

export type Tariff = "149" | "199";

export type BotSession = {
  activeRequestId: string | null;
  awaiting: AwaitingState;
  chatId: string | null;
  chatType: string | null;
  currentVariantIdx: number;
  customerEmail?: string | null;
  customerEmailRequestId?: string | null;
  deliveryMethodRequestId?: string | null;
  initiatorTimezone: string | null;
  lastCallbackData: string | null;
  lastBotMessageIds: string[];
  lastEventType: string | null;
  lastInlineMessageId: string | null;
  lastUpdateId: number | null;
  lastVariantIdx: number;
  recipientName: string | null;
  tariffPending: Tariff | null;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUserId: string;
  tgUsername: string | null;
  tzReturnTo: string | null;
};

export type LegacyBotSession = {
  active_request_id?: string | number | null;
  awaiting?: string | null;
  chat_id?: string | number | null;
  chat_type?: string | null;
  current_variant_idx?: string | number | null;
  customer_email?: string | null;
  customer_email_request_id?: string | number | null;
  delivery_method_request_id?: string | number | null;
  initiator_timezone?: string | null;
  last_callback_data?: string | null;
  last_bot_message_ids?: Array<string | number> | null;
  last_event_type?: string | null;
  last_inline_message_id?: string | number | null;
  last_update_id?: string | number | null;
  last_variant_idx?: string | number | null;
  recipient_name?: string | null;
  tariff_pending?: string | null;
  tg_first_name?: string | null;
  tg_last_name?: string | null;
  tg_user_id?: string | number | null;
  tg_username?: string | null;
  tz_return_to?: string | null;
};

export function createEmptySession(tgUserId: string): BotSession {
  return {
    activeRequestId: null,
    awaiting: "none",
    chatId: null,
    chatType: null,
    currentVariantIdx: 0,
    customerEmail: null,
    customerEmailRequestId: null,
    deliveryMethodRequestId: null,
    initiatorTimezone: null,
    lastCallbackData: null,
    lastBotMessageIds: [],
    lastEventType: null,
    lastInlineMessageId: null,
    lastUpdateId: null,
    lastVariantIdx: 0,
    recipientName: null,
    tariffPending: null,
    tgFirstName: null,
    tgLastName: null,
    tgUserId,
    tgUsername: null,
    tzReturnTo: null
  };
}

export function normalizeAwaitingState(value: string | null | undefined): AwaitingState {
  switch (value) {
    case "recipient_name":
    case "tz":
    case "delivery_username":
    case "email":
      return value;
    default:
      return "none";
  }
}

export function fromLegacySession(
  input: LegacyBotSession | null | undefined,
  fallbackTgUserId: string
): BotSession {
  const source = input ?? {};

  return {
    activeRequestId:
      source.active_request_id != null ? String(source.active_request_id) : null,
    awaiting: normalizeAwaitingState(source.awaiting),
    chatId: source.chat_id != null ? String(source.chat_id) : null,
    chatType: source.chat_type != null ? String(source.chat_type) : null,
    currentVariantIdx: Number(source.current_variant_idx ?? 0) || 0,
    customerEmail: source.customer_email ?? null,
    customerEmailRequestId:
      source.customer_email_request_id != null
        ? String(source.customer_email_request_id)
        : null,
    deliveryMethodRequestId:
      source.delivery_method_request_id != null
        ? String(source.delivery_method_request_id)
        : null,
    initiatorTimezone: source.initiator_timezone ?? null,
    lastCallbackData: source.last_callback_data ?? null,
    lastBotMessageIds: Array.isArray(source.last_bot_message_ids)
      ? source.last_bot_message_ids.map((value) => String(value))
      : [],
    lastEventType: source.last_event_type ?? null,
    lastInlineMessageId:
      source.last_inline_message_id != null ? String(source.last_inline_message_id) : null,
    lastUpdateId:
      source.last_update_id != null ? Number(source.last_update_id) : null,
    lastVariantIdx: Number(source.last_variant_idx ?? 0) || 0,
    recipientName: source.recipient_name ?? null,
    tariffPending:
      source.tariff_pending === "149" || source.tariff_pending === "199"
        ? source.tariff_pending
        : null,
    tgFirstName: source.tg_first_name ?? null,
    tgLastName: source.tg_last_name ?? null,
    tgUserId:
      source.tg_user_id != null ? String(source.tg_user_id) : fallbackTgUserId,
    tgUsername: source.tg_username ?? null,
    tzReturnTo: source.tz_return_to ?? null
  };
}

export function toLegacySession(session: BotSession): LegacyBotSession {
  return {
    active_request_id: session.activeRequestId,
    awaiting: session.awaiting,
    chat_id: session.chatId,
    chat_type: session.chatType,
    current_variant_idx: String(session.currentVariantIdx),
    customer_email: session.customerEmail ?? null,
    customer_email_request_id: session.customerEmailRequestId ?? null,
    delivery_method_request_id: session.deliveryMethodRequestId ?? null,
    initiator_timezone: session.initiatorTimezone,
    last_callback_data: session.lastCallbackData,
    last_bot_message_ids: session.lastBotMessageIds,
    last_event_type: session.lastEventType,
    last_inline_message_id: session.lastInlineMessageId,
    last_update_id: session.lastUpdateId,
    last_variant_idx: String(session.lastVariantIdx),
    recipient_name: session.recipientName,
    tariff_pending: session.tariffPending,
    tg_first_name: session.tgFirstName,
    tg_last_name: session.tgLastName,
    tg_user_id: session.tgUserId,
    tg_username: session.tgUsername,
    tz_return_to: session.tzReturnTo
  };
}

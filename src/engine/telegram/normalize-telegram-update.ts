import type { NormalizedTelegramEvent } from "../../domain/events.js";

type TelegramUpdate = Record<string, any>;

export function normalizeTelegramUpdate(input: unknown): NormalizedTelegramEvent {
  const update = (input ?? {}) as TelegramUpdate;
  const message = update.message ?? null;
  const editedMessage = update.edited_message ?? null;
  const callback = update.callback_query ?? null;
  const preCheckout = update.pre_checkout_query ?? null;
  const myChatMember = update.my_chat_member ?? null;
  const chatMember = update.chat_member ?? null;
  const successfulPayment = message?.successful_payment ?? null;

  const from =
    callback?.from ??
    message?.from ??
    editedMessage?.from ??
    preCheckout?.from ??
    myChatMember?.from ??
    chatMember?.from ??
    null;

  const chat =
    message?.chat ??
    editedMessage?.chat ??
    callback?.message?.chat ??
    myChatMember?.chat ??
    chatMember?.chat ??
    null;

  const text = message?.text ?? editedMessage?.text ?? null;
  const isStart =
    typeof text === "string" && (text === "/start" || text.startsWith("/start "));

  let eventType: NormalizedTelegramEvent["eventType"] = "unknown";

  if (callback) {
    eventType = "callback";
  } else if (preCheckout) {
    eventType = "pre_checkout";
  } else if (successfulPayment) {
    eventType = "successful_payment";
  } else if (text) {
    eventType = "text";
  } else if (myChatMember) {
    eventType = "my_chat_member";
  } else if (chatMember) {
    eventType = "chat_member";
  }

  const oldMemberStatus =
    myChatMember?.old_chat_member?.status ??
    chatMember?.old_chat_member?.status ??
    null;

  const newMemberStatus =
    myChatMember?.new_chat_member?.status ??
    chatMember?.new_chat_member?.status ??
    null;

  return {
    botBlocked: eventType === "my_chat_member" && newMemberStatus === "kicked",
    botUnblocked:
      eventType === "my_chat_member" &&
      oldMemberStatus === "kicked" &&
      (newMemberStatus === "member" || newMemberStatus === "administrator"),
    callbackData: callback?.data ? String(callback.data) : null,
    callbackMessageId:
      callback?.message?.message_id != null ? String(callback.message.message_id) : null,
    callbackQueryId: callback?.id ? String(callback.id) : null,
    channel: "telegram",
    chatId: chat?.id != null ? String(chat.id) : null,
    chatType: chat?.type ? String(chat.type) : null,
    currency:
      preCheckout?.currency ?? successfulPayment?.currency ?? null,
    eventType,
    invoicePayload:
      preCheckout?.invoice_payload ?? successfulPayment?.invoice_payload ?? null,
    isStart,
    messageId:
      message?.message_id != null
        ? String(message.message_id)
        : editedMessage?.message_id != null
          ? String(editedMessage.message_id)
          : callback?.message?.message_id != null
            ? String(callback.message.message_id)
            : null,
    providerPaymentChargeId:
      successfulPayment?.provider_payment_charge_id != null
        ? String(successfulPayment.provider_payment_charge_id)
        : null,
    raw: update,
    text: typeof text === "string" ? text : null,
    tgFirstName: from?.first_name ? String(from.first_name) : null,
    tgLastName: from?.last_name ? String(from.last_name) : null,
    tgUserId: from?.id != null ? String(from.id) : null,
    tgUsername: from?.username ? String(from.username) : null,
    userFirstName: from?.first_name ? String(from.first_name) : null,
    userLastName: from?.last_name ? String(from.last_name) : null,
    userId: from?.id != null ? String(from.id) : null,
    username: from?.username ? String(from.username) : null,
    totalAmount:
      typeof (preCheckout?.total_amount ?? successfulPayment?.total_amount) === "number"
        ? Number(preCheckout?.total_amount ?? successfulPayment?.total_amount)
        : null,
    updateId: update.update_id != null ? Number(update.update_id) : null
  };
}

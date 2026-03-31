import type { NormalizedChannelEvent } from "../../domain/events.js";

type MaxUpdate = Record<string, any>;

export function normalizeMaxUpdate(input: unknown): NormalizedChannelEvent {
  const update = (input ?? {}) as MaxUpdate;
  const updateType = typeof update.update_type === "string" ? update.update_type : "unknown";
  const user =
    update.user ??
    update.callback?.user ??
    update.callback?.sender ??
    update.message?.sender ??
    update.message?.user ??
    null;
  const text =
    update.message?.body?.text ??
    update.callback?.message?.body?.text ??
    update.message?.text ??
    update.text ??
    null;
  const callbackData =
    update.callback?.payload ??
    update.callback?.data ??
    update.payload ??
    null;

  let eventType: NormalizedChannelEvent["eventType"] = "unknown";
  if (updateType === "message_callback") {
    eventType = "callback";
  } else if (updateType === "message_created" || (typeof text === "string" && text.length > 0)) {
    eventType = "text";
  }

  const isStart =
    updateType === "bot_started" ||
    (typeof text === "string" && (text === "/start" || text.startsWith("/start ")));

  const userId = user?.user_id != null ? String(user.user_id) : null;
  const firstName = user?.first_name ? String(user.first_name) : user?.name ? String(user.name) : null;
  const lastName = user?.last_name ? String(user.last_name) : null;
  const username = user?.username ? String(user.username) : null;
  const resolvedChatId =
    userId ??
    (update.callback?.user?.user_id != null
      ? String(update.callback.user.user_id)
      : null) ??
    (update.chat_id != null
      ? String(update.chat_id)
      : update.callback?.chat_id != null
        ? String(update.callback.chat_id)
        : update.callback?.message?.recipient?.chat_id != null
          ? String(update.callback.message.recipient.chat_id)
      : update.message?.chat_id != null
        ? String(update.message.chat_id)
        : null);

  return {
    botBlocked: false,
    botUnblocked: false,
    callbackData: callbackData != null ? String(callbackData) : null,
    callbackMessageId:
      update.callback?.message?.message_id != null
        ? String(update.callback.message.message_id)
        : update.message?.message_id != null
          ? String(update.message.message_id)
          : null,
    callbackQueryId:
      update.callback?.callback_id != null ? String(update.callback.callback_id) : null,
    channel: "max",
    chatId: resolvedChatId,
    chatType: update.chat_type != null ? String(update.chat_type) : null,
    currency: null,
    eventType,
    invoicePayload: null,
    isStart,
    messageId:
      update.message?.message_id != null ? String(update.message.message_id) : null,
    providerPaymentChargeId: null,
    raw: update,
    text: typeof text === "string" ? text : null,
    tgFirstName: firstName,
    tgLastName: lastName,
    tgUserId: userId,
    tgUsername: username,
    totalAmount: null,
    updateId:
      typeof update.timestamp === "number"
        ? Number(update.timestamp)
        : update.update_id != null
          ? Number(update.update_id)
          : null,
    userFirstName: firstName,
    userId,
    userLastName: lastName,
    username
  };
}

import type { NormalizedTelegramEvent } from "../../domain/events.js";
import type { BotSession } from "../../domain/session.js";
import { parseCallbackData } from "./callback-parser.js";
import {
  normalizeEmail,
  normalizeTelegramUsername,
  type RouterIntent
} from "./router-intents.js";

export function routeTelegramEvent(
  session: BotSession,
  event: NormalizedTelegramEvent
): RouterIntent {
  if (event.eventType === "callback" && event.callbackData) {
    const callback = parseCallbackData(event.callbackData);

    switch (callback.kind) {
      case "start_new":
      case "start_force_new":
      case "start_continue":
      case "gen_first":
      case "gen_next":
      case "go_seal":
      case "tz_change":
      case "delivery_manual":
      case "delivery_username":
        return mapSimpleCallback(callback.kind);
      case "seal_pick":
        return { kind: "seal_pick", idx: callback.idx };
      case "pay":
        return { kind: "pay", tariff: callback.tariff };
      case "tz":
        return { kind: "tz_set", timezone: callback.timezone };
      default:
        return { kind: "ignore", reason: `Unknown callback: ${event.callbackData}` };
    }
  }

  if (event.eventType === "text" && event.isStart) {
    return { kind: "start_intro" };
  }

  if (event.eventType === "text" && event.text) {
    const text = event.text.trim();

    if (session.awaiting === "recipient_name" && text) {
      return { kind: "recipient_name_received", recipientName: text };
    }

    if (session.awaiting === "email") {
      const email = normalizeEmail(text);
      return email
        ? { kind: "email_received", email }
        : { kind: "ignore", reason: "Invalid email format" };
    }

    if (session.awaiting === "delivery_username") {
      const username = normalizeTelegramUsername(text);
      return username
        ? { kind: "delivery_username_received", username }
        : { kind: "ignore", reason: "Invalid Telegram username format" };
    }
  }

  return { kind: "ignore", reason: `Unhandled event type: ${event.eventType}` };
}

function mapSimpleCallback(
  kind:
    | "start_new"
    | "start_force_new"
    | "start_continue"
    | "gen_first"
    | "gen_next"
    | "go_seal"
    | "tz_change"
    | "delivery_manual"
    | "delivery_username"
): RouterIntent {
  switch (kind) {
    case "start_new":
      return { kind: "start_new" };
    case "start_force_new":
      return { kind: "start_force_new" };
    case "start_continue":
      return { kind: "start_continue" };
    case "gen_first":
      return { kind: "generate_first" };
    case "gen_next":
      return { kind: "generate_next" };
    case "go_seal":
      return { kind: "go_seal" };
    case "tz_change":
      return { kind: "tz_change_requested" };
    case "delivery_manual":
      return { kind: "delivery_manual" };
    case "delivery_username":
      return { kind: "delivery_username_requested" };
  }
}

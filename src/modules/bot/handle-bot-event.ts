import type { NormalizedTelegramEvent } from "../../domain/events.js";
import type { BotSession } from "../../domain/session.js";
import { currentCampaignTexts } from "../../campaigns/current-campaign-texts.js";
import { routeTelegramEvent } from "./telegram-router.js";

export type BotEffect =
  | { type: "send_message"; chatId: string; text: string }
  | { type: "start_workflow"; workflow: string; payload: Record<string, unknown> }
  | { type: "persist_delivery_username"; requestId: string; username: string }
  | { type: "persist_email"; email: string }
  | { type: "noop"; reason: string };

export type BotHandlerResult = {
  effects: BotEffect[];
  session: BotSession;
};

export function handleBotEvent(
  session: BotSession,
  event: NormalizedTelegramEvent
): BotHandlerResult {
  if (
    event.eventType === "text" &&
    !event.isStart &&
    !["recipient_name", "email", "delivery_username"].includes(session.awaiting)
  ) {
    return {
      effects: [
        {
          type: "send_message",
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.buttonsOnly
        }
      ],
      session: {
        ...session,
        chatId: event.chatId ?? session.chatId,
        chatType: event.chatType ?? session.chatType,
        lastEventType: event.eventType,
        lastUpdateId: event.updateId,
        tgFirstName: event.tgFirstName ?? session.tgFirstName,
        tgLastName: event.tgLastName ?? session.tgLastName,
        tgUsername: event.tgUsername ?? session.tgUsername
      }
    };
  }

  const routed = routeTelegramEvent(session, event);
  const baseSession: BotSession = {
    ...session,
    chatId: event.chatId ?? session.chatId,
    chatType: event.chatType ?? session.chatType,
    lastCallbackData: event.callbackData ?? session.lastCallbackData,
    lastEventType: event.eventType,
    lastInlineMessageId: event.callbackMessageId ?? session.lastInlineMessageId,
    lastUpdateId: event.updateId,
    tgFirstName: event.tgFirstName ?? session.tgFirstName,
    tgLastName: event.tgLastName ?? session.tgLastName,
    tgUsername: event.tgUsername ?? session.tgUsername
  };

  switch (routed.kind) {
    case "start_intro":
      return startWorkflow(baseSession, event, "2_START_INTRO");
    case "start_new":
      return startWorkflow(baseSession, event, "2_START");
    case "start_force_new":
      return startWorkflow(baseSession, event, "2_START", { forceNew: true });
    case "start_continue":
      return startWorkflow(baseSession, event, "2_START_CONTINUE");
    case "generate_first":
      return startWorkflow(baseSession, event, "2_GEN", { mode: "first" });
    case "generate_next":
      return startWorkflow(baseSession, event, "2_GEN", { mode: "next" });
    case "go_seal":
      return startWorkflow(baseSession, event, "2_GO_SEAL");
    case "seal_pick":
      return startWorkflow(baseSession, event, "2_SEAL_PICK", { idx: routed.idx });
    case "pay":
      return {
        effects: [
          {
            type: "start_workflow",
            workflow: "2_PAY",
            payload: { tariff: routed.tariff }
          }
        ],
        session: {
          ...baseSession,
          tariffPending: routed.tariff
        }
      };
    case "tz_set":
      return {
        effects: [
          {
            type: "start_workflow",
            workflow: "2_TZ",
            payload: { timezone: routed.timezone }
          }
        ],
        session: {
          ...baseSession,
          awaiting: "none",
          initiatorTimezone: routed.timezone
        }
      };
    case "tz_change_requested":
      return {
        effects: [
          {
            type: "start_workflow",
            workflow: "2_TZ_CHANGE",
            payload: {}
          }
        ],
        session: {
          ...baseSession,
          awaiting: "tz",
          tzReturnTo: "seal_pick_tariffs"
        }
      };
    case "delivery_manual":
      return {
        effects: [
          {
            type: "start_workflow",
            workflow: "2_DELIV_MANUAL",
            payload: {}
          }
        ],
        session: {
          ...baseSession,
          awaiting: "none",
          tariffPending: "199"
        }
      };
    case "delivery_username_requested":
      return {
        effects: [
          {
            type: "start_workflow",
            workflow: "2_DELIV_USERNAME",
            payload: {}
          }
        ],
        session: {
          ...baseSession,
          awaiting: "delivery_username",
          tariffPending: baseSession.tariffPending ?? "199"
        }
      };
    case "recipient_name_received":
      return startWorkflow(baseSession, event, "2_RECIPIENT_NAME", {
        recipientName: routed.recipientName
      });
    case "email_received":
      return {
        effects: [{ type: "persist_email", email: routed.email }],
        session: {
          ...baseSession,
          awaiting: "none",
          customerEmail: routed.email
        }
      };
    case "delivery_username_received":
      return {
        effects: baseSession.activeRequestId
          ? [
              {
                type: "persist_delivery_username",
                requestId: baseSession.activeRequestId,
                username: routed.username
              }
            ]
          : [{ type: "noop", reason: "No active request id for delivery username" }],
        session: {
          ...baseSession,
          awaiting: "none",
          tariffPending: "199"
        }
      };
    case "ignore":
      return {
        effects: [{ type: "noop", reason: routed.reason }],
        session: baseSession
      };
  }
}

function startWorkflow(
  session: BotSession,
  event: NormalizedTelegramEvent,
  workflow: string,
  payload: Record<string, unknown> = {}
): BotHandlerResult {
  return {
    effects: [
      {
        type: "start_workflow",
        workflow,
        payload
      }
    ],
    session: {
      ...session,
      chatId: event.chatId ?? session.chatId
    }
  };
}

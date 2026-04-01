import type { NormalizedChannelEvent } from "../../domain/events.js";
import { createEmptySession, type BotSession } from "../../domain/session.js";
import {
  campaignTimezoneKeyboard,
  currentCampaignRules,
  getCampaignTariffAmount,
  isCampaignTariff
} from "../../campaigns/active-campaign.js";
import { currentCampaignTexts } from "../../campaigns/active-campaign.js";
import { handleBotEvent } from "../bot/handle-bot-event.js";
import type { PaymentService } from "../payments/payment-service.js";
import type { PaymentsRepository } from "../payments/payments-repository.js";
import type { RequestsRepository } from "../repositories/requests-repository.js";
import type { UsersRepository } from "../repositories/users-repository.js";
import type { VariantsRepository } from "../repositories/variants-repository.js";
import type { PreviewRenderer } from "../rendering/preview-renderer.js";
import type { SessionStore } from "../state/session-store.js";
import type { TelegramGateway } from "../telegram/telegram-gateway.js";
import { InMemoryRequestsRepository } from "../../adapters/requests/in-memory-requests-repository.js";
import { InMemoryUsersRepository } from "../../adapters/users/in-memory-users-repository.js";
import { buildPreviewVariant } from "../../adapters/variants/preview-builder.js";

export class TelegramApplicationService {
  private static readonly START_CHAT_CLEANUP_WINDOW = 200;
  private static readonly START_CHAT_CLEANUP_CONCURRENCY = 12;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly requestsRepository: RequestsRepository,
    private readonly sessionStore: SessionStore,
    private readonly telegramGateway: TelegramGateway,
    private readonly variantsRepository: VariantsRepository,
    private readonly paymentService: PaymentService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly previewRenderer?: PreviewRenderer,
    private readonly channel: "telegram" | "max" = "telegram"
  ) {}

  async processEvent(event: NormalizedChannelEvent): Promise<BotSession | null> {
    if (!event.userId) {
      return null;
    }

    const currentSession =
      (await this.sessionStore.get(event.userId)) ?? createEmptySession(event.userId);

    if (
      event.updateId != null &&
      currentSession.lastUpdateId != null &&
      event.updateId <= currentSession.lastUpdateId
    ) {
      return currentSession;
    }

    if (event.isStart) {
      this.kickOffChatCleanup(currentSession, event);
    }

    const { effects, session } = handleBotEvent(currentSession, event);
    let nextSession = session;

    for (const effect of effects) {
      switch (effect.type) {
        case "start_workflow":
          nextSession = await this.applyWorkflowEffect(nextSession, event, effect.workflow, effect.payload);
          break;
        case "persist_delivery_username":
          if (nextSession.activeRequestId) {
            await this.requestsRepository.setDeliveryUsername(
              nextSession.activeRequestId,
              effect.username
            );
          }
          nextSession = {
            ...nextSession,
            awaiting: "none",
            deliveryMethodRequestId: nextSession.activeRequestId,
            tariffPending: "199"
          };
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? nextSession.chatId ?? nextSession.tgUserId,
            text: `Принято: ${effect.username}. Можно продолжить оплату.`,
            replyMarkup: {
              inline_keyboard: [[{
                text: currentCampaignTexts.buttons.continuePayment,
                callback_data: "PAY:199"
              }]]
            }
          });
          break;
        case "persist_email":
          nextSession = {
            ...nextSession,
            customerEmail: effect.email,
            customerEmailRequestId: nextSession.activeRequestId,
            awaiting: "none"
          };
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? nextSession.chatId ?? nextSession.tgUserId,
            text: currentCampaignTexts.prompts.emailSaved,
            replyMarkup: nextSession.tariffPending
              ? {
                  inline_keyboard: [[
                    {
                      text: currentCampaignTexts.buttons.continuePayment,
                      callback_data: `PAY:${nextSession.tariffPending}`
                    }
                  ]]
                }
              : undefined
          });
          break;
        case "send_message":
          await this.telegramGateway.sendMessage({
            chatId: effect.chatId,
            preserveInlineKeyboard: effect.text === currentCampaignTexts.prompts.buttonsOnly,
            stickyInlineKeyboard:
              this.channel === "max" &&
              effect.text === currentCampaignTexts.prompts.aboutBureau,
            replyMarkup: effect.replyMarkup,
            text: effect.text
          });
          break;
        case "noop":
          break;
      }
    }

    await this.sessionStore.set(nextSession);
    return nextSession;
  }

  private async applyWorkflowEffect(
    session: BotSession,
    event: NormalizedChannelEvent,
    workflow: string,
    payload: Record<string, unknown>
  ): Promise<BotSession> {
    switch (workflow) {
      case "2_START_INTRO":
        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          stickyInlineKeyboard: this.channel === "max",
          text: currentCampaignTexts.prompts.aboutBureau,
          replyMarkup: session.activeRequestId
            ? {
                inline_keyboard: [
                  [{ text: currentCampaignTexts.buttons.continueCurrentRequest, callback_data: "START_CONTINUE" }],
                  [{ text: currentCampaignTexts.buttons.restart, callback_data: "START_FORCE_NEW" }]
                ]
              }
            : {
                inline_keyboard: [[{ text: "Начать", callback_data: "START_NEW" }]]
              }
        });
        return session;
      case "2_START": {
        const user = await this.usersRepository.upsertTelegramUser({
          tgUserId: session.tgUserId,
          tgFirstName: session.tgFirstName,
          tgLastName: session.tgLastName,
          tgUsername: session.tgUsername
        });

        if ((payload.forceNew === true || session.activeRequestId) && session.activeRequestId) {
          await this.requestsRepository.closeOpenRequest(session.activeRequestId);
        }

        if (
          this.usersRepository instanceof InMemoryUsersRepository &&
          this.requestsRepository instanceof InMemoryRequestsRepository
        ) {
          (this.requestsRepository as InMemoryRequestsRepository).bindTelegramUser(
            session.tgUserId,
            user.id
          );
        }

        const request = await this.requestsRepository.createOpenRequest(user.id);

        const nextSession: BotSession = {
          ...session,
          activeRequestId: request.id,
          awaiting: "recipient_name",
          currentVariantIdx: 0,
          customerEmail: null,
          customerEmailRequestId: null,
          deliveryMethodRequestId: null,
          initiatorTimezone: null,
          lastVariantIdx: 0,
          recipientName: null,
          tariffPending: null
        };

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.enterRecipientName
        });

        return nextSession;
      }
      case "2_START_CONTINUE": {
        let requestId = session.activeRequestId;
        let request = requestId ? await this.requestsRepository.getById(requestId) : null;

        if (!request) {
          const latestOpen = await this.requestsRepository.findLatestOpenByTelegramUserId(
            session.tgUserId
          );
          if (latestOpen) {
            requestId = latestOpen.id;
            request = latestOpen;
          }
        }

        if (!requestId || !request) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.noActiveRequest,
            replyMarkup: {
              inline_keyboard: [[{ text: currentCampaignTexts.buttons.restart, callback_data: "START_NEW" }]]
            }
          });
          return {
            ...session,
            activeRequestId: null
          };
        }

        if (!request.recipientName) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.resumeNeedsRecipient
          });
          return {
            ...session,
            activeRequestId: requestId,
            awaiting: "recipient_name",
            recipientName: null
          };
        }

        const recoveredLastVariantIdx = await this.resolveLastVariantIdx(
          requestId,
          session.lastVariantIdx
        );

        if (recoveredLastVariantIdx < 1) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.resumePreparing
          });
          return this.applyWorkflowEffect(
            {
              ...session,
              activeRequestId: requestId,
              awaiting: "none",
              recipientName: request.recipientName
            },
            event,
            "2_GEN",
            { mode: "first" }
          );
        }

        return this.applyWorkflowEffect(
          {
            ...session,
            activeRequestId: requestId,
            awaiting: "none",
            currentVariantIdx: recoveredLastVariantIdx,
            lastVariantIdx: recoveredLastVariantIdx,
            recipientName: request.recipientName
          },
          event,
          "2_GO_SEAL",
          {}
        );
      }
      case "2_RECIPIENT_NAME": {
        const recipientName =
          typeof payload.recipientName === "string" ? payload.recipientName.trim() : "";
        if (!session.activeRequestId || !recipientName) {
          return session;
        }

        await this.requestsRepository.updateRecipientName(session.activeRequestId, recipientName);

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.preparingDocument
        });

        return this.applyWorkflowEffect(
          {
            ...session,
            awaiting: "none",
            recipientName
          },
          event,
          "2_GEN",
          { mode: "first" }
        );
      }
      case "2_save_session_final":
        return session;
      case "2_GEN": {
        if (!session.activeRequestId) {
          return session;
        }

        const request = await this.requestsRepository.getById(session.activeRequestId);
        if (!request) {
          return session;
        }

        const targetIdx = payload.mode === "first"
          ? 1
          : Math.max(1, Math.min(3, session.lastVariantIdx + 1));

        const variant = buildPreviewVariant({
          request,
          session,
          targetIdx
        });

        await this.variantsRepository.set(session.activeRequestId, variant);

        const nextSession: BotSession = {
          ...session,
          awaiting: "none",
          currentVariantIdx: variant.idx,
          lastVariantIdx: variant.idx
        };

        const remaining = 3 - variant.idx;
        const variantReplyMarkup =
          variant.idx < 3
            ? {
                inline_keyboard: [
                  [{ text: currentCampaignTexts.buttons.prepareNextVariant, callback_data: "GEN_NEXT" }],
                  [{ text: currentCampaignTexts.buttons.goToSeal, callback_data: "GO_SEAL" }]
                ]
              }
            : {
                inline_keyboard: [
                  [{ text: currentCampaignTexts.buttons.pickVariant(1), callback_data: "SEAL_PICK:1" }],
                  [{ text: currentCampaignTexts.buttons.pickVariant(2), callback_data: "SEAL_PICK:2" }],
                  [{ text: currentCampaignTexts.buttons.pickVariant(3), callback_data: "SEAL_PICK:3" }]
                ]
              };

        const variantText = currentCampaignTexts.variant.prepared(variant.idx, remaining);

        if (this.previewRenderer) {
          const preview = await this.previewRenderer.renderPreview({
            requestId: session.activeRequestId,
            variant
          });

          await this.telegramGateway.sendPhoto({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            photoPath: preview.renderedPath,
            caption: variantText,
            replyMarkup: variantReplyMarkup
          });
        } else {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: variantText,
            replyMarkup: variantReplyMarkup
          });
        }

        return nextSession;
      }
      case "2_GO_SEAL":
        if (!session.activeRequestId || session.lastVariantIdx < 1) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.variant.noVariantsYet,
            replyMarkup: {
              inline_keyboard: [[{ text: currentCampaignTexts.buttons.prepareDocument, callback_data: "GEN_FIRST" }]]
            }
          });
          return session;
        }

        if (session.lastVariantIdx < 3) {
          const generatedVariantButtons = Array.from(
            { length: session.lastVariantIdx },
            (_, index) => [
              {
                text: currentCampaignTexts.buttons.pickVariant(index + 1),
                callback_data: `SEAL_PICK:${index + 1}`
              }
            ]
          );

          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.variant.sealChoicePartial(session.lastVariantIdx),
            replyMarkup: {
              inline_keyboard: [
                ...generatedVariantButtons,
                [{ text: currentCampaignTexts.buttons.prepareNextVariant, callback_data: "GEN_NEXT" }]
              ]
            }
          });
          return session;
        }

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.variant.sealChoiceFull,
          replyMarkup: {
            inline_keyboard: [
              [{ text: currentCampaignTexts.buttons.pickVariant(1), callback_data: "SEAL_PICK:1" }],
              [{ text: currentCampaignTexts.buttons.pickVariant(2), callback_data: "SEAL_PICK:2" }],
              [{ text: currentCampaignTexts.buttons.pickVariant(3), callback_data: "SEAL_PICK:3" }]
            ]
          }
        });
        return session;
      case "2_SEAL_PICK": {
        if (!session.activeRequestId) {
          return session;
        }

        const idx = typeof payload.idx === "number" ? payload.idx : null;
        if (!idx) {
          return session;
        }

        if (idx > session.lastVariantIdx) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.sealMissing(idx, session.lastVariantIdx),
            replyMarkup: {
              inline_keyboard: [
                [{ text: currentCampaignTexts.buttons.prepareNextVariant, callback_data: "GEN_NEXT" }],
                [{ text: currentCampaignTexts.buttons.goToSeal, callback_data: "GO_SEAL" }]
              ]
            }
          });
          return session;
        }

        const variant = await this.variantsRepository.get(session.activeRequestId, idx);
        if (!variant) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.sealExpired,
            replyMarkup: {
              inline_keyboard: [[{ text: currentCampaignTexts.buttons.prepareDocument, callback_data: "GEN_FIRST" }]]
            }
          });
          return session;
        }

        await this.requestsRepository.setSelectedVariant(session.activeRequestId, idx);
        const request = await this.requestsRepository.getById(session.activeRequestId);

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.variant.selected(variant.idx),
          replyMarkup: {
            inline_keyboard: [
              [{ text: currentCampaignTexts.buttons.pay149, callback_data: "PAY:149" }],
              [
                {
                  text: currentCampaignTexts.buttons.pay199,
                  callback_data: "PAY:199"
                }
              ],
              [{ text: currentCampaignTexts.buttons.chooseAnotherVariant, callback_data: "GO_SEAL" }],
              [
                {
                  text: request?.initiatorTimezone
                    ? currentCampaignTexts.buttons.timezoneValue(request.initiatorTimezone)
                    : currentCampaignTexts.buttons.setTimezone,
                  callback_data: "TZ_CHANGE"
                }
              ]
            ]
          }
        });

        return {
          ...session,
          currentVariantIdx: idx
        };
      }
      case "2_PAY": {
        if (!session.activeRequestId) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.paymentNeedsRequest,
            replyMarkup: {
              inline_keyboard: [[{ text: currentCampaignTexts.buttons.restart, callback_data: "START_NEW" }]]
            }
          });
          return session;
        }

        const request = await this.requestsRepository.getById(session.activeRequestId);
        if (!request) {
          return session;
        }

        if (!request.selectedVariantIdx) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.paymentNeedsVariant,
            replyMarkup: {
              inline_keyboard: [[{ text: currentCampaignTexts.buttons.goToSeal, callback_data: "GO_SEAL" }]]
            }
          });
          return session;
        }

        const tariff = isCampaignTariff(payload.tariff) ? payload.tariff : session.tariffPending;

        if (tariff && currentCampaignRules.tariffs[tariff].requiresTimezone && !request.initiatorTimezone) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.chooseTimezone,
            replyMarkup: {
              inline_keyboard: campaignTimezoneKeyboard()
            }
          });

          return {
            ...session,
            awaiting: "tz",
            tariffPending: "199"
          };
        }

        const hasRequestScopedDeliveryChoice =
          session.deliveryMethodRequestId === session.activeRequestId;

        if (
          tariff &&
          currentCampaignRules.tariffs[tariff].requiresDeliveryChoice &&
          !hasRequestScopedDeliveryChoice
        ) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.chooseDeliveryMethod,
            replyMarkup: {
              inline_keyboard: [
                [{ text: "🔒 Указать @username", callback_data: "DELIV_USERNAME" }],
                [{ text: "📩 Получить и переслать вручную", callback_data: "DELIV_MANUAL" }]
              ]
            }
          });

          return {
            ...session,
            awaiting: "none",
            tariffPending: "199"
          };
        }

        const hasRequestScopedEmail =
          Boolean(session.customerEmail) &&
          session.customerEmailRequestId === session.activeRequestId;

        if (!hasRequestScopedEmail) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.enterEmail
          });

          return {
            ...session,
            awaiting: "email",
            customerEmail: null,
            customerEmailRequestId: null,
            tariffPending: tariff ?? null
          };
        }

        if (!tariff) {
          return session;
        }

        const idempotenceKey = `${Date.now()}_${Math.floor(Math.random() * 1e9)}_r${session.activeRequestId}_u${session.tgUserId}`;
        const payment = await this.paymentService.createPayment({
          customerEmail: session.customerEmail!,
          idempotenceKey,
          requestId: session.activeRequestId,
          tariff,
          tgUserId: session.tgUserId
        });

        await this.paymentsRepository.insertPendingPayment({
          amount: getCampaignTariffAmount(tariff),
          idempotenceKey: payment.idempotenceKey,
          payload: {
            provider: "yookassa",
            request_id: session.activeRequestId,
            tariff,
            tg_user_id: session.tgUserId
          },
          providerPaymentId: payment.providerPaymentId,
          requestId: session.activeRequestId,
          tariff
        });

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.preparedPayment(payment.confirmationUrl),
          replyMarkup: {
            inline_keyboard: [[{ text: currentCampaignTexts.buttons.payNow, url: payment.confirmationUrl }]]
          }
        });

        return {
          ...session,
          awaiting: "none",
          tariffPending: tariff ?? null
        };
      }
      case "2_TZ":
        if (typeof payload.timezone !== "string") {
          return session;
        }

        const nextSessionAfterTimezone: BotSession = {
          ...session,
          awaiting: "none",
          initiatorTimezone: payload.timezone
        };

        if (session.activeRequestId) {
          await this.requestsRepository.setInitiatorTimezone(session.activeRequestId, payload.timezone);
        }
        await this.usersRepository.setTimezone(session.tgUserId, payload.timezone);

        if (session.tzReturnTo === "seal_pick_tariffs") {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text: currentCampaignTexts.prompts.timezoneSavedTariff,
            replyMarkup: {
              inline_keyboard: [
                [{ text: currentCampaignTexts.buttons.pay149, callback_data: "PAY:149" }],
                [
                  {
                    text: currentCampaignTexts.buttons.pay199,
                    callback_data: "PAY:199"
                  }
                ],
                [{ text: currentCampaignTexts.buttons.chooseAnotherVariant, callback_data: "GO_SEAL" }]
              ]
            }
          });
          return {
            ...nextSessionAfterTimezone,
            tzReturnTo: "seal_pick_tariffs"
          };
        }

        if (session.tariffPending === "199") {
          return this.applyWorkflowEffect(
            {
              ...nextSessionAfterTimezone,
              tariffPending: "199",
              tzReturnTo: null
            },
            event,
            "2_PAY",
            { tariff: "199" }
          );
        }

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.timezoneSaved
        });

        return {
          ...nextSessionAfterTimezone,
          tzReturnTo: session.tzReturnTo
        };
      case "2_TZ_CHANGE":
        return {
          ...session,
          awaiting: "tz",
          tariffPending: null,
          tzReturnTo: "seal_pick_tariffs"
        };
      case "2_DELIV_MANUAL":
        if (session.activeRequestId) {
          await this.requestsRepository.setDeliveryManual(session.activeRequestId);
        }
        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.deliveryManualSaved,
          replyMarkup: {
            inline_keyboard: [[{ text: currentCampaignTexts.buttons.continuePayment, callback_data: "PAY:199" }]]
          }
        });
        return {
          ...session,
          awaiting: "none",
          deliveryMethodRequestId: session.activeRequestId,
          tariffPending: "199"
        };
      case "2_DELIV_USERNAME":
        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: currentCampaignTexts.prompts.enterDeliveryUsername
        });
        return {
          ...session,
          awaiting: "delivery_username",
          tariffPending: "199"
        };
      default:
        return session;
    }
  }

  private async resolveLastVariantIdx(
    requestId: string,
    sessionLastVariantIdx: number
  ): Promise<number> {
    if (sessionLastVariantIdx > 0) {
      return sessionLastVariantIdx;
    }

    for (const idx of [3, 2, 1]) {
      const variant = await this.variantsRepository.get(requestId, idx);
      if (variant) {
        return idx;
      }
    }

    return 0;
  }

  private async cleanupChatOnStart(
    _session: BotSession,
    event: NormalizedChannelEvent
  ): Promise<void> {
    const chatId = event.chatId;
    const messageId = event.messageId;
    if (!chatId || !messageId) {
      return;
    }

    const currentMessageId = Number(messageId);
    if (!Number.isFinite(currentMessageId)) {
      return;
    }

    const upperBound = currentMessageId - 1;
    if (upperBound < 1) {
      return;
    }

    const lowerBound = Math.max(
      1,
      upperBound - TelegramApplicationService.START_CHAT_CLEANUP_WINDOW + 1
    );
    const messageIds: string[] = [];
    for (let id = upperBound; id >= lowerBound; id -= 1) {
      messageIds.push(String(id));
    }

    for (
      let batchStart = 0;
      batchStart < messageIds.length;
      batchStart += TelegramApplicationService.START_CHAT_CLEANUP_CONCURRENCY
    ) {
      const batch = messageIds.slice(
        batchStart,
        batchStart + TelegramApplicationService.START_CHAT_CLEANUP_CONCURRENCY
      );

      await Promise.all(
        batch.map(async (id) => {
          try {
            await this.telegramGateway.deleteMessage({
              chatId,
              messageId: id
            });
          } catch {}
        })
      );
    }
  }

  private kickOffChatCleanup(session: BotSession, event: NormalizedChannelEvent): void {
    void this.cleanupChatOnStart(session, event).catch(() => {});
  }
}

import type { NormalizedTelegramEvent } from "../../domain/events.js";
import { createEmptySession, type BotSession } from "../../domain/session.js";
import type { PaymentService } from "../payments/payment-service.js";
import type { PaymentsRepository } from "../payments/payments-repository.js";
import type { RequestsRepository } from "../requests/requests-repository.js";
import type { SessionStore } from "../session/session-store.js";
import type { TelegramGateway } from "../telegram/telegram-gateway.js";
import type { UsersRepository } from "../users/users-repository.js";
import type { PreviewRenderer } from "../variants/preview-renderer.js";
import type { VariantsRepository } from "../variants/variants-repository.js";
import { buildPreviewVariant } from "../variants/preview-builder.js";
import { handleBotEvent } from "../bot/handle-bot-event.js";
import { InMemoryUsersRepository } from "../users/in-memory-users-repository.js";
import { InMemoryRequestsRepository } from "../requests/in-memory-requests-repository.js";

export class TelegramApplicationService {
  private static readonly START_CHAT_CLEANUP_WINDOW = 200;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly requestsRepository: RequestsRepository,
    private readonly sessionStore: SessionStore,
    private readonly telegramGateway: TelegramGateway,
    private readonly variantsRepository: VariantsRepository,
    private readonly paymentService: PaymentService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly previewRenderer?: PreviewRenderer
  ) {}

  async processEvent(event: NormalizedTelegramEvent): Promise<BotSession | null> {
    if (!event.tgUserId) {
      return null;
    }

    const currentSession =
      (await this.sessionStore.get(event.tgUserId)) ?? createEmptySession(event.tgUserId);

    if (event.isStart) {
      await this.cleanupChatOnStart(currentSession, event);
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
              inline_keyboard: [[{ text: "💳 Продолжить оплату", callback_data: "PAY:199" }]]
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
            text: "🏛 Бюро «Разрешено»\n\nEmail сохранен. Можно продолжить оплату.",
            replyMarkup: nextSession.tariffPending
              ? {
                  inline_keyboard: [[
                    {
                      text: "💳 Продолжить оплату",
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
    event: NormalizedTelegramEvent,
    workflow: string,
    payload: Record<string, unknown>
  ): Promise<BotSession> {
    switch (workflow) {
      case "2_START_INTRO":
        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text: "🏛 Бюро «Разрешено»\n\nВыберите дальнейшее действие.",
          replyMarkup: session.activeRequestId
            ? {
                inline_keyboard: [
                  [{ text: "Продолжить обращение", callback_data: "START_CONTINUE" }],
                  [{ text: "Начать заново", callback_data: "START_FORCE_NEW" }]
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
          this.requestsRepository.bindTelegramUser(session.tgUserId, user.id);
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
          text: "🏛 Бюро «Разрешено»\n\nУкажите имя получателя."
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
            text: "Активное обращение не найдено. Начните заново.",
            replyMarkup: {
              inline_keyboard: [[{ text: "Начать заново", callback_data: "START_NEW" }]]
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
            text: "Продолжаем текущее обращение. Укажите имя получателя."
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
            text: "Продолжаем текущее обращение. Подготавливаю документ."
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
          text: "Обращение зарегистрировано. Подготовка документа займет около минуты."
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
        const availability =
          remaining === 2
            ? "Осталось 2 варианта в рамках текущего обращения.\n\n"
            : remaining === 1
              ? "Остался 1 вариант в рамках текущего обращения.\n\n"
              : "Подготовка вариантов в рамках текущего обращения завершена.\n\n";

        const variantReplyMarkup =
          variant.idx < 3
            ? {
                inline_keyboard: [
                  [{ text: "Подготовить другой вариант", callback_data: "GEN_NEXT" }],
                  [{ text: "Перейти к заверению", callback_data: "GO_SEAL" }]
                ]
              }
            : {
                inline_keyboard: [
                  [{ text: "Вариант 1", callback_data: "SEAL_PICK:1" }],
                  [{ text: "Вариант 2", callback_data: "SEAL_PICK:2" }],
                  [{ text: "Вариант 3", callback_data: "SEAL_PICK:3" }]
                ]
              };

        const variantText =
          `🏛 Бюро «Разрешено»\n\nПодготовлен вариант №${variant.idx}.\n` +
          availability +
          "Вступает в силу немедленно.\nОбжалованию не подлежит.";

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
            text: "🏛 Бюро «Разрешено»\n\nСначала подготовьте хотя бы один вариант.",
            replyMarkup: {
              inline_keyboard: [[{ text: "Подготовить документ", callback_data: "GEN_FIRST" }]]
            }
          });
          return session;
        }

        if (session.lastVariantIdx < 3) {
          const generatedVariantButtons = Array.from(
            { length: session.lastVariantIdx },
            (_, index) => [
              {
                text: `Вариант ${index + 1}`,
                callback_data: `SEAL_PICK:${index + 1}`
              }
            ]
          );

          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text:
              "🏛 Бюро «Разрешено»\n\nДля вступления документа в силу требуется заверение.\n\n" +
              `Сейчас подготовлено вариантов: ${session.lastVariantIdx}.\n` +
              "Выберите вариант для заверения или подготовьте еще один.",
            replyMarkup: {
              inline_keyboard: [
                ...generatedVariantButtons,
                [{ text: "Подготовить другой вариант", callback_data: "GEN_NEXT" }]
              ]
            }
          });
          return session;
        }

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text:
            "🏛 Бюро «Разрешено»\n\nДля вступления документа в силу требуется заверение.\n\n" +
            "Подготовка вариантов завершена.\nУкажите вариант, подлежащий заверению.",
          replyMarkup: {
            inline_keyboard: [
              [{ text: "Вариант 1", callback_data: "SEAL_PICK:1" }],
              [{ text: "Вариант 2", callback_data: "SEAL_PICK:2" }],
              [{ text: "Вариант 3", callback_data: "SEAL_PICK:3" }]
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
            text:
              `🏛 Бюро «Разрешено» \n\nВариант №${idx} еще не подготовлен.\n\n` +
              `Сейчас доступно вариантов: ${session.lastVariantIdx}.`,
            replyMarkup: {
              inline_keyboard: [
                [{ text: "Подготовить другой вариант", callback_data: "GEN_NEXT" }],
                [{ text: "Перейти к заверению", callback_data: "GO_SEAL" }]
              ]
            }
          });
          return session;
        }

        const variant = await this.variantsRepository.get(session.activeRequestId, idx);
        if (!variant) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text:
              "🏛 Бюро «Разрешено» \nСрок хранения варианта истек.\nПодготовьте документ заново.",
            replyMarkup: {
              inline_keyboard: [[{ text: "Подготовить документ", callback_data: "GEN_FIRST" }]]
            }
          });
          return session;
        }

        await this.requestsRepository.setSelectedVariant(session.activeRequestId, idx);
        const request = await this.requestsRepository.getById(session.activeRequestId);

        await this.telegramGateway.sendMessage({
          chatId: event.chatId ?? session.chatId ?? session.tgUserId,
          text:
            `🏛 Бюро «Разрешено» \n\nВыбран вариант №${variant.idx}.\n\n` +
            "Для вступления документа в силу требуется заверение.\n\n" +
            "Вступает в силу немедленно.\nОбжалованию не подлежит.",
          replyMarkup: {
            inline_keyboard: [
              [{ text: "Заверить — 149 ₽", callback_data: "PAY:149" }],
              [
                {
                  text: "Заверить + направить 8 марта с 9:00 до 9:30 — 199 ₽",
                  callback_data: "PAY:199"
                }
              ],
              [{ text: "Выбрать другой вариант", callback_data: "GO_SEAL" }],
              [
                {
                  text: request?.initiatorTimezone
                    ? `Часовой пояс: ${request.initiatorTimezone}. Сменить?`
                    : "Часовой пояс: не установлен. Установить?",
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
            text: "Перед оплатой нужно начать обращение заново.",
            replyMarkup: {
              inline_keyboard: [[{ text: "Начать заново", callback_data: "START_NEW" }]]
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
            text: "Перед оплатой нужно выбрать вариант для заверения.",
            replyMarkup: {
              inline_keyboard: [[{ text: "Перейти к заверению", callback_data: "GO_SEAL" }]]
            }
          });
          return session;
        }

        const tariff =
          payload.tariff === "149" || payload.tariff === "199"
            ? payload.tariff
            : session.tariffPending;

        if (tariff === "199" && !request.initiatorTimezone) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text:
              "🏛 Бюро «Разрешено» \n\nДля тарифа «Заверить + направить» документ будет " +
              "отправлен 8 марта с 09:00 (в течение нескольких минут) по вашему времени.\n\n" +
              "Выберите ваш часовой пояс:",
            replyMarkup: {
              inline_keyboard: [
                [{ text: "MSK (UTC+3)", callback_data: "TZ:Europe/Moscow" }],
                [
                  {
                    text: "Екатеринбург (UTC+5)",
                    callback_data: "TZ:Asia/Yekaterinburg"
                  },
                  { text: "Омск (UTC+6)", callback_data: "TZ:Asia/Omsk" }
                ],
                [
                  {
                    text: "Красноярск (UTC+7)",
                    callback_data: "TZ:Asia/Krasnoyarsk"
                  },
                  { text: "Иркутск (UTC+8)", callback_data: "TZ:Asia/Irkutsk" }
                ],
                [
                  { text: "Якутск (UTC+9)", callback_data: "TZ:Asia/Yakutsk" },
                  {
                    text: "Владивосток (UTC+10)",
                    callback_data: "TZ:Asia/Vladivostok"
                  }
                ]
              ]
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

        if (tariff === "199" && !hasRequestScopedDeliveryChoice) {
          await this.telegramGateway.sendMessage({
            chatId: event.chatId ?? session.chatId ?? session.tgUserId,
            text:
              "🏛 Бюро «Разрешено» \n\nВыберите способ вручения 8 марта.\n" +
              "Бот не пишет получателю напрямую.",
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
            text:
              "🏛 Бюро «Разрешено»\n\nУкажите email для отправки чека. " +
              "Это обязательное условие для оплаты.\nПример: name@example.com"
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
          amount: tariff === "149" ? 149 : 199,
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
          text:
            "Оплата подготовлена. Нажмите кнопку ниже:\n" +
            payment.confirmationUrl,
          replyMarkup: {
            inline_keyboard: [[{ text: "💳 Оплатить", url: payment.confirmationUrl }]]
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
            text: "Часовой пояс сохранен. Можно продолжить выбор тарифа.",
            replyMarkup: {
              inline_keyboard: [
                [{ text: "Заверить — 149 ₽", callback_data: "PAY:149" }],
                [
                  {
                    text: "Заверить + направить 8 марта с 9:00 до 9:30 — 199 ₽",
                    callback_data: "PAY:199"
                  }
                ],
                [{ text: "Выбрать другой вариант", callback_data: "GO_SEAL" }]
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
          text: "Часовой пояс сохранен."
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
          text: "Способ вручения сохранен. Можно продолжить оплату.",
          replyMarkup: {
            inline_keyboard: [[{ text: "💳 Продолжить оплату", callback_data: "PAY:199" }]]
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
          text:
            "Укажите @username получателя (пример: @ivan_ivanov).\n\n" +
            "Бот не напишет ему напрямую — 8 марта мы пришлем вам PNG и кнопку открытия чата."
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
    event: NormalizedTelegramEvent
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

    const lowerBound = Math.max(
      1,
      currentMessageId - TelegramApplicationService.START_CHAT_CLEANUP_WINDOW
    );
    for (let id = currentMessageId; id >= lowerBound; id -= 1) {
      try {
        await this.telegramGateway.deleteMessage({
          chatId,
          messageId: String(id)
        });
      } catch {}
    }
  }
}

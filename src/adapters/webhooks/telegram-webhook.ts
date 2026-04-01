import type { FastifyInstance, FastifyRequest } from "fastify";

import { TelegramApplicationService } from "../../engine/app/telegram-application-service.js";
import { normalizeTelegramUpdate } from "../../engine/telegram/normalize-telegram-update.js";

export function registerTelegramWebhook(app: FastifyInstance): void {
  const handler = async (
    request: FastifyRequest<{ Body: unknown; Params: { botId?: string } }>
  ) => {
    const botId = request.params?.botId ?? app.defaultBotId;
    const context = app.appContexts[botId];
    if (!context) {
      app.log.warn({ botId }, "Telegram webhook received for unknown bot runtime");
      return { ok: false, error: "unknown_bot" };
    }

    const event = normalizeTelegramUpdate(request.body);

    if (!event.tgUserId) {
      app.log.warn({ body: request.body }, "Telegram event without tgUserId");
      return { ok: true, ignored: true };
    }

    const service = new TelegramApplicationService(
      context.usersRepository,
      context.requestsRepository,
      context.sessionStore,
      context.telegramGateway,
      context.variantsRepository,
      context.paymentService,
      context.paymentsRepository,
      context.previewRenderer,
      "telegram"
    );
    const nextSession = await service.processEvent(event);

    app.log.info(
      {
        botId,
        eventType: event.eventType,
        nextSession,
        tgUserId: event.tgUserId
      },
      "Telegram webhook processed"
    );

    return { ok: true };
  };

  app.post("/webhooks/telegram", handler);
  app.post("/webhooks/telegram/:botId", handler);
}

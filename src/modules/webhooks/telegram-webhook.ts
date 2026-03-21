import type { FastifyInstance } from "fastify";

import { normalizeTelegramUpdate } from "../../engine/telegram/normalize-telegram-update.js";
import { TelegramApplicationService } from "../app/telegram-application-service.js";

export function registerTelegramWebhook(app: FastifyInstance): void {
  app.post("/webhooks/telegram", async (request) => {
    const event = normalizeTelegramUpdate(request.body);

    if (!event.tgUserId) {
      app.log.warn({ body: request.body }, "Telegram event without tgUserId");
      return { ok: true, ignored: true };
    }

    const service = new TelegramApplicationService(
      app.appContext.usersRepository,
      app.appContext.requestsRepository,
      app.appContext.sessionStore,
      app.appContext.telegramGateway,
      app.appContext.variantsRepository,
      app.appContext.paymentService,
      app.appContext.paymentsRepository,
      app.appContext.previewRenderer
    );
    const nextSession = await service.processEvent(event);

    app.log.info(
      {
        eventType: event.eventType,
        nextSession,
        tgUserId: event.tgUserId
      },
      "Telegram webhook processed"
    );

    return { ok: true };
  });
}

import type { FastifyInstance, FastifyRequest } from "fastify";

import { TelegramApplicationService } from "../../engine/app/telegram-application-service.js";
import { normalizeMaxUpdate } from "../../engine/max/normalize-max-update.js";

export function registerMaxWebhook(app: FastifyInstance): void {
  const handler = async (
    request: FastifyRequest<{ Body: unknown; Params: { botId?: string } }>
  ) => {
    const botId = request.params?.botId ?? app.defaultBotId;
    const context = app.appContexts[botId];
    if (!context) {
      app.log.warn({ botId }, "MAX webhook received for unknown bot runtime");
      return { ok: false, error: "unknown_bot" };
    }

    if (context.botRuntime.channel !== "max") {
      app.log.warn({ botId, channel: context.botRuntime.channel }, "MAX webhook routed to non-MAX runtime");
      return { ok: false, error: "wrong_channel" };
    }

    if (context.botRuntime.webhookSecret) {
      const providedSecret = request.headers["x-max-bot-api-secret"];
      if (providedSecret !== context.botRuntime.webhookSecret) {
        app.log.warn({ botId }, "MAX webhook rejected due to invalid secret");
        return { ok: false, error: "invalid_secret" };
      }
    }

    const event = normalizeMaxUpdate(request.body);

    if (!event.userId) {
      app.log.warn({ body: request.body }, "MAX event without userId");
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
      context.previewRenderer
    );
    const nextSession = await service.processEvent(event);

    app.log.info(
      {
        botId,
        channel: "max",
        eventType: event.eventType,
        nextSession,
        userId: event.userId
      },
      "MAX webhook processed"
    );

    return { ok: true };
  };

  app.post("/webhooks/max", handler);
  app.post("/webhooks/max/:botId", handler);
}

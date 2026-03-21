import type { FastifyInstance } from "fastify";
import { YookassaWebhookService } from "../../engine/payments/yookassa-webhook-service.js";

export function registerYookassaWebhook(app: FastifyInstance): void {
  app.post("/webhooks/yookassa", async (request) => {
    const service = new YookassaWebhookService(
      app.appContext.paymentsRepository,
      app.appContext.requestsRepository,
      app.appContext.documentsRepository,
      app.appContext.deliveriesRepository,
      app.appContext.sessionStore
    );
    const result = await service.handleWebhook(request.body as Record<string, unknown>);
    app.log.info({ body: request.body, result }, "YooKassa webhook received");
    return { ok: true };
  });
}

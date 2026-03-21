import type { FastifyInstance } from "fastify";

import { DeliveryWorkerService } from "../deliveries/delivery-worker-service.js";

export function registerInternalRoutes(app: FastifyInstance): void {
  app.get("/internal/state", async () => ({
    env: app.appContext.configSummary,
    ok: true
  }));

  app.post("/internal/deliveries/run-once", async () => {
    const worker = new DeliveryWorkerService(
      app.appContext.deliveriesRepository,
      app.appContext.documentsRepository,
      app.appContext.requestsRepository,
      app.appContext.renderingAdapter,
      app.appContext.deliveryTransport
    );

    const result = await worker.runOnce();
    app.log.info({ result }, "Delivery worker run-once completed");
    return { ok: true, result };
  });
}

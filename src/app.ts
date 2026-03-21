import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "./config/env.js";
import { createApplicationContext } from "./modules/app/create-application-context.js";
import { registerInternalRoutes } from "./modules/webhooks/internal-routes.js";
import { registerTelegramWebhook } from "./modules/webhooks/telegram-webhook.js";
import { registerYookassaWebhook } from "./modules/webhooks/yookassa-webhook.js";

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: true
  });
  const appContext = createApplicationContext(config, app.log);

  app.decorate("appContext", appContext);

  app.get("/health", async () => ({
    ok: true,
    service: "congrats-migration",
    env: config.nodeEnv
  }));

  registerTelegramWebhook(app);
  registerYookassaWebhook(app);
  registerInternalRoutes(app);

  return app;
}

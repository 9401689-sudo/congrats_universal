import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "./config/env.js";
import { createApplicationContext } from "./engine/app/create-application-context.js";
import { registerInternalRoutes } from "./adapters/webhooks/internal-routes.js";
import { registerTelegramWebhook } from "./adapters/webhooks/telegram-webhook.js";
import { registerYookassaWebhook } from "./adapters/webhooks/yookassa-webhook.js";

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: true
  });
  const appContexts = Object.fromEntries(
    Object.entries(config.botRuntimes).map(([botId, runtime]) => [
      botId,
      createApplicationContext(config, runtime, app.log)
    ])
  );
  const appContext = appContexts[config.defaultBotId];

  if (!appContext) {
    throw new Error(`Default bot context not found: ${config.defaultBotId}`);
  }

  app.decorate("appContext", appContext);
  app.decorate("appContexts", appContexts);
  app.decorate("defaultBotId", config.defaultBotId);

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

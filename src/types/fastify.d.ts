import "fastify";

import type { ApplicationContext } from "../engine/app/create-application-context.js";

declare module "fastify" {
  interface FastifyInstance {
    appContext: ApplicationContext;
    appContexts: Record<string, ApplicationContext>;
    defaultBotId: string;
  }
}

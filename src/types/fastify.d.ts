import "fastify";

import type { ApplicationContext } from "../modules/app/create-application-context.js";

declare module "fastify" {
  interface FastifyInstance {
    appContext: ApplicationContext;
  }
}

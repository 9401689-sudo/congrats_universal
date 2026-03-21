import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp(config);

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info({ port: config.port }, "HTTP server started");
  } catch (error) {
    app.log.error(error, "Failed to start application");
    process.exitCode = 1;
  }
}

void main();

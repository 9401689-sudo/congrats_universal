import { loadConfig } from "../src/config/env.js";

type CliOptions = {
  botId: string;
  callbackUrl: string;
};

function parseArgs(args: string[]): CliOptions {
  let botId = "";
  let callbackUrl = "";

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if ((value === "--bot-id" || value === "-b") && args[index + 1]) {
      botId = args[index + 1]!;
      index += 1;
      continue;
    }

    if ((value === "--url" || value === "-u") && args[index + 1]) {
      callbackUrl = args[index + 1]!;
      index += 1;
    }
  }

  if (!botId || !callbackUrl) {
    throw new Error("Usage: npm run max:subscribe -- --bot-id <id> --url <https://.../webhooks/max/...>");
  }

  return { botId, callbackUrl };
}

async function main(): Promise<void> {
  const { botId, callbackUrl } = parseArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  const runtime = config.botRuntimes[botId];

  if (!runtime) {
    throw new Error(`Unknown bot runtime: ${botId}`);
  }

  if (runtime.channel !== "max") {
    throw new Error(`Bot runtime ${botId} is not a MAX runtime`);
  }

  const botToken = runtime.botToken ?? runtime.telegramBotToken;
  if (!botToken) {
    throw new Error(`Bot runtime ${botId} does not have a bot token`);
  }

  const response = await fetch("https://platform-api.max.ru/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      secret: runtime.webhookSecret,
      update_types: ["bot_started", "message_callback", "message_created"],
      url: callbackUrl
    })
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`MAX subscription failed: ${response.status} ${bodyText}`);
  }

  process.stdout.write(`${bodyText}\n`);
}

await main();

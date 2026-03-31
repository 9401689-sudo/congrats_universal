import { Bot } from "@maxhub/max-bot-api";

import { loadConfig } from "../src/config/env.js";

type CliOptions = {
  botId: string;
};

function parseArgs(args: string[]): CliOptions {
  let botId = "";

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if ((value === "--bot-id" || value === "-b") && args[index + 1]) {
      botId = args[index + 1]!;
      index += 1;
    }
  }

  if (!botId) {
    throw new Error("Usage: npm run max:set-commands -- --bot-id <id>");
  }

  return { botId };
}

async function main(): Promise<void> {
  const { botId } = parseArgs(process.argv.slice(2));
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

  const bot = new Bot(botToken);
  await bot.api.setMyCommands([
    {
      name: "about",
      description: "О Бюро"
    }
  ]);

  process.stdout.write("MAX commands updated\n");
}

await main();

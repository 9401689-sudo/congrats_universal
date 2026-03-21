import { z } from "zod";

const botRuntimeSchema = z.object({
  campaignId: z.string().min(1),
  id: z.string().min(1),
  telegramBotToken: z.string().min(1).optional(),
  yookassaReturnUrl: z.string().url().optional(),
  yookassaSecretKey: z.string().min(1).optional(),
  yookassaShopId: z.string().min(1).optional()
});

const envSchema = z.object({
  BOT_RUNTIMES_JSON: z.string().min(1).optional(),
  CAMPAIGN_ID: z.string().min(1).default("march8-razresheno"),
  DATABASE_URL: z.string().min(1).optional(),
  DEFAULT_BOT_ID: z.string().min(1).default("default"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PYTHON_RENDERER_BIN: z.string().min(1).optional(),
  PYTHON_RENDERER_SCRIPT_PATH: z.string().min(1).optional(),
  PYTHON_RENDERER_TEMPLATES_DIR: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  RENDER_OUTPUT_DIR: z.string().min(1).default(".local-renders"),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  YOOKASSA_RETURN_URL: z.string().url().optional(),
  YOOKASSA_SECRET_KEY: z.string().min(1).optional(),
  YOOKASSA_SHOP_ID: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0")
});

export type BotRuntimeConfig = {
  campaignId: string;
  id: string;
  telegramBotToken?: string;
  yookassaReturnUrl?: string;
  yookassaSecretKey?: string;
  yookassaShopId?: string;
};

export type AppConfig = {
  botRuntimes: Record<string, BotRuntimeConfig>;
  databaseUrl?: string;
  defaultBotId: string;
  host: string;
  nodeEnv: "development" | "test" | "production";
  port: number;
  pythonRendererBin?: string;
  pythonRendererScriptPath?: string;
  pythonRendererTemplatesDir?: string;
  redisUrl?: string;
  renderOutputDir: string;
  telegramBotToken?: string;
  yookassaReturnUrl?: string;
  yookassaSecretKey?: string;
  yookassaShopId?: string;
};

function parseBotRuntimes(env: z.infer<typeof envSchema>): Record<string, BotRuntimeConfig> {
  if (env.BOT_RUNTIMES_JSON) {
    const parsed = z.array(botRuntimeSchema).parse(JSON.parse(env.BOT_RUNTIMES_JSON));
    return Object.fromEntries(parsed.map((runtime) => [runtime.id, runtime]));
  }

  return {
    [env.DEFAULT_BOT_ID]: {
      campaignId: env.CAMPAIGN_ID,
      id: env.DEFAULT_BOT_ID,
      telegramBotToken: env.TELEGRAM_BOT_TOKEN,
      yookassaReturnUrl: env.YOOKASSA_RETURN_URL,
      yookassaSecretKey: env.YOOKASSA_SECRET_KEY,
      yookassaShopId: env.YOOKASSA_SHOP_ID
    }
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const botRuntimes = parseBotRuntimes(parsed);

  return {
    botRuntimes,
    databaseUrl: parsed.DATABASE_URL,
    defaultBotId: parsed.DEFAULT_BOT_ID,
    host: parsed.HOST,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    pythonRendererBin: parsed.PYTHON_RENDERER_BIN,
    pythonRendererScriptPath: parsed.PYTHON_RENDERER_SCRIPT_PATH,
    pythonRendererTemplatesDir: parsed.PYTHON_RENDERER_TEMPLATES_DIR,
    redisUrl: parsed.REDIS_URL,
    renderOutputDir: parsed.RENDER_OUTPUT_DIR,
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    yookassaReturnUrl: parsed.YOOKASSA_RETURN_URL,
    yookassaSecretKey: parsed.YOOKASSA_SECRET_KEY,
    yookassaShopId: parsed.YOOKASSA_SHOP_ID
  };
}

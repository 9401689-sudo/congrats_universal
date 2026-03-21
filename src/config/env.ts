import { z } from "zod";

const envSchema = z.object({
  CAMPAIGN_ID: z.string().min(1).default("march8-razresheno"),
  DATABASE_URL: z.string().min(1).optional(),
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

export type AppConfig = {
  campaignId: string;
  databaseUrl?: string;
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    campaignId: parsed.CAMPAIGN_ID,
    databaseUrl: parsed.DATABASE_URL,
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

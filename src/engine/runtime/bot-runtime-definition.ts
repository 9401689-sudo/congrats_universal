export type BotRuntimeDefinition = {
  botToken?: string;
  campaignId: string;
  channel: "max" | "telegram";
  id: string;
  webhookSecret?: string;
  telegramBotToken?: string;
  yookassaReturnUrl?: string;
  yookassaSecretKey?: string;
  yookassaShopId?: string;
};

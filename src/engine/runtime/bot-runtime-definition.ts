export type BotRuntimeDefinition = {
  botToken?: string;
  campaignId: string;
  channel: "max" | "telegram";
  id: string;
  telegramBotToken?: string;
  yookassaReturnUrl?: string;
  yookassaSecretKey?: string;
  yookassaShopId?: string;
};

import type { CampaignTariff, CampaignTimezoneOption } from "./current-campaign-rules.js";

export type CampaignConfig = typeof import("./current-campaign.js").currentCampaign;
export type CampaignTexts = typeof import("./current-campaign-texts.js").currentCampaignTexts;
export type CampaignRules = {
  defaultDeliveryTimezone: string;
  timezoneOffsets: Record<string, number>;
  timezoneOptions: readonly CampaignTimezoneOption[];
  tariffs: Record<
    CampaignTariff,
    { amount: number; requiresDeliveryChoice: boolean; requiresTimezone: boolean }
  >;
};
export type CampaignVariants = typeof import("./current-campaign-variants.js").currentCampaignVariants;

export type CampaignDefinition = {
  buildDocumentNumber(requestId: string): string;
  buildDocumentSubtitle(requestId: string): string;
  buildRedisSessionKey(tgUserId: string): string;
  buildRedisVariantKey(requestId: string, idx: number): string;
  buildRenderPayload(input: {
    docNo?: string;
    intro?: string;
    outputPath?: string;
    points?: string[];
    recipientName?: string;
    requestId: string;
    templatesDir?: string;
  }): Record<string, unknown>;
  campaign: CampaignConfig;
  rules: CampaignRules;
  table(tableName: string): string;
  texts: CampaignTexts;
  variants: CampaignVariants;
};

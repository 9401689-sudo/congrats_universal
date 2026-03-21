import { getCampaignDefinition } from "./campaign-registry.js";

export const activeCampaignDefinition = getCampaignDefinition(process.env.CAMPAIGN_ID);

export const activeCampaign = activeCampaignDefinition.campaign;
export const activeCampaignTexts = activeCampaignDefinition.texts;
export const activeCampaignRules = activeCampaignDefinition.rules;
export const activeCampaignVariants = activeCampaignDefinition.variants;

export const buildActiveCampaignDocumentNumber = activeCampaignDefinition.buildDocumentNumber;
export const buildActiveCampaignDocumentSubtitle = activeCampaignDefinition.buildDocumentSubtitle;
export const buildActiveCampaignRedisSessionKey = activeCampaignDefinition.buildRedisSessionKey;
export const buildActiveCampaignRedisVariantKey = activeCampaignDefinition.buildRedisVariantKey;
export const buildActiveCampaignRenderPayload = activeCampaignDefinition.buildRenderPayload;
export const activeCampaignTable = activeCampaignDefinition.table;

export type ActiveCampaignTariff = keyof typeof activeCampaignRules.tariffs & string;

export function isActiveCampaignTariff(value: unknown): value is ActiveCampaignTariff {
  return typeof value === "string" && value in activeCampaignRules.tariffs;
}

export function getActiveCampaignTariffAmount(tariff: ActiveCampaignTariff): number {
  return activeCampaignRules.tariffs[tariff].amount;
}

export function activeCampaignTimezoneKeyboard(): Array<
  Array<{ callback_data: string; text: string }>
> {
  return [
    [
      {
        text: activeCampaignRules.timezoneOptions[0].label,
        callback_data: activeCampaignRules.timezoneOptions[0].callbackData
      }
    ],
    activeCampaignRules.timezoneOptions.slice(1, 3).map((option) => ({
      text: option.label,
      callback_data: option.callbackData
    })),
    activeCampaignRules.timezoneOptions.slice(3, 5).map((option) => ({
      text: option.label,
      callback_data: option.callbackData
    })),
    activeCampaignRules.timezoneOptions.slice(5, 7).map((option) => ({
      text: option.label,
      callback_data: option.callbackData
    }))
  ];
}

export function computeActiveCampaignScheduledAt(timezone: string): string {
  const offset =
    activeCampaignRules.timezoneOffsets[
      timezone as keyof typeof activeCampaignRules.timezoneOffsets
    ] ?? activeCampaignRules.timezoneOffsets[activeCampaignRules.defaultDeliveryTimezone];

  const now = new Date();
  const targetYear =
    now.getUTCMonth() > 2 || (now.getUTCMonth() === 2 && now.getUTCDate() > 8)
      ? now.getUTCFullYear() + 1
      : now.getUTCFullYear();

  return new Date(Date.UTC(targetYear, 2, 8, 9 - offset, 0, 0)).toISOString();
}

// Backward-compatible aliases for incremental migration from the single-campaign layout.
export const currentCampaign = activeCampaign;
export const currentCampaignTexts = activeCampaignTexts;
export const currentCampaignRules = activeCampaignRules;
export const currentCampaignVariants = activeCampaignVariants;
export const buildCampaignDocumentNumber = buildActiveCampaignDocumentNumber;
export const buildCampaignDocumentSubtitle = buildActiveCampaignDocumentSubtitle;
export const buildCampaignRedisSessionKey = buildActiveCampaignRedisSessionKey;
export const buildCampaignRedisVariantKey = buildActiveCampaignRedisVariantKey;
export const buildCampaignRenderPayload = buildActiveCampaignRenderPayload;
export const campaignTable = activeCampaignTable;
export const campaignTimezoneKeyboard = activeCampaignTimezoneKeyboard;
export const computeCampaignScheduledAt = computeActiveCampaignScheduledAt;
export const getCampaignTariffAmount = getActiveCampaignTariffAmount;
export const isCampaignTariff = isActiveCampaignTariff;

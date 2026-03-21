import type { CampaignDefinition } from "./campaign-definition.js";
import {
  buildCampaignDocumentNumber,
  buildCampaignDocumentSubtitle,
  buildCampaignRedisSessionKey,
  buildCampaignRedisVariantKey,
  campaignTable,
  currentCampaign
} from "./current-campaign.js";
import { buildCampaignRenderPayload } from "./current-campaign-renderer.js";
import { currentCampaignRules } from "./current-campaign-rules.js";
import { currentCampaignTexts } from "./current-campaign-texts.js";
import { currentCampaignVariants } from "./current-campaign-variants.js";

export const march8RazreshenoCampaign: CampaignDefinition = {
  buildDocumentNumber: buildCampaignDocumentNumber,
  buildDocumentSubtitle: buildCampaignDocumentSubtitle,
  buildRedisSessionKey: buildCampaignRedisSessionKey,
  buildRedisVariantKey: buildCampaignRedisVariantKey,
  buildRenderPayload: buildCampaignRenderPayload,
  campaign: currentCampaign,
  rules: currentCampaignRules,
  table: campaignTable,
  texts: currentCampaignTexts,
  variants: currentCampaignVariants
};

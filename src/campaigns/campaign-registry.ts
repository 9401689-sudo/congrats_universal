import type { CampaignDefinition } from "./campaign-definition.js";
import { march8RazreshenoCampaign } from "./march8-razresheno-campaign.js";

export const campaignRegistry: Record<string, CampaignDefinition> = {
  "march8-razresheno": march8RazreshenoCampaign
};

export function getCampaignDefinition(campaignId = "march8-razresheno"): CampaignDefinition {
  const campaign = campaignRegistry[campaignId];
  if (!campaign) {
    const available = Object.keys(campaignRegistry).sort().join(", ");
    throw new Error(`Unknown CAMPAIGN_ID: ${campaignId}. Available campaigns: ${available}`);
  }

  return campaign;
}

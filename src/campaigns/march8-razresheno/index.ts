import { defineCampaign } from "../define-campaign.js";
import {
  buildDocumentNumber,
  buildDocumentSubtitle,
  buildRedisSessionKey,
  buildRedisVariantKey,
  campaign,
  table
} from "./config.js";
import { buildRenderPayload } from "./renderer.js";
import { rules } from "./rules.js";
import { texts } from "./texts.js";
import { variants } from "./variants.js";

export const march8RazreshenoCampaign = defineCampaign({
  buildDocumentNumber,
  buildDocumentSubtitle,
  buildRedisSessionKey,
  buildRedisVariantKey,
  buildRenderPayload,
  campaign,
  rules,
  table,
  texts,
  variants
});

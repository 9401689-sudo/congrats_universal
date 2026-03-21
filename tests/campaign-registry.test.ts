import test from "node:test";
import assert from "node:assert/strict";

import { getCampaignDefinition, listCampaignIds } from "../src/campaigns/campaign-registry.js";

test("campaign registry exposes the default march8 campaign", () => {
  const ids = listCampaignIds();
  assert.deepEqual(ids, ["march8-razresheno"]);

  const campaign = getCampaignDefinition("march8-razresheno");
  assert.equal(campaign.campaign.id, "march8-razresheno");
  assert.equal(campaign.campaign.telegram.botUsername, "razresheno_buro_bot");
});

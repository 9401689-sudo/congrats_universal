import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCamelCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`
    )
    .join("");
}

function writeFile(path: string, content: string): void {
  writeFileSync(path, content, "utf8");
  console.log(`created ${path}`);
}

const rawName = process.argv[2];
if (!rawName) {
  fail("Usage: npm run make:campaign -- <campaign-id>");
}

const campaignId = toSlug(rawName);
if (!campaignId) {
  fail("Campaign id must contain latin letters or numbers.");
}

const campaignDir = join(process.cwd(), "src", "campaigns", campaignId);
if (existsSync(campaignDir)) {
  fail(`Campaign already exists: ${campaignDir}`);
}

mkdirSync(campaignDir, { recursive: true });

const exportName = `${toCamelCase(campaignId)}Campaign`;
const title = campaignId
  .split("-")
  .filter(Boolean)
  .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
  .join(" ");
const storageNamespace = campaignId.replace(/-/g, "_");

writeFile(
  join(campaignDir, "config.ts"),
  `import type { CampaignConfig } from "../campaign-definition.js";

export const campaign: CampaignConfig = {
  brand: {
    bureauName: "Bureau ${title}",
    paymentItemDescription: "Electronic card (${title})"
  },
  databaseSchema: "${storageNamespace}",
  document: {
    assetsVersion: "assets-1",
    defaultDocNumber: "0000-000",
    engineVersion: "engine-1",
    headerSmall: "Campaign header",
    introOptions: ["Allowed:", "Approved:", "It is permitted:"],
    numberPrefix: "0000",
    pointsPool: [
      "Replace this pool with campaign-specific points.",
      "Each generated variant samples from this list."
    ],
    sourceLine: "Source: ${campaignId}",
    subtitlePrefix: "DOCUMENT No.",
    title: "${title.toUpperCase()}"
  },
  id: "${campaignId}",
  renderer: {
    templatesDir: "/mnt/templates/${campaignId}"
  },
  storageNamespace: "${storageNamespace}",
  telegram: {
    botUsername: "${campaignId}_bot",
    qrUrl: "https://t.me/${campaignId}_bot"
  }
};

export function buildDocumentNumber(requestId: string): string {
  return \`\${campaign.document.numberPrefix}-\${requestId.padStart(3, "0")}\`;
}

export function buildDocumentSubtitle(requestId: string): string {
  return \`\${campaign.document.subtitlePrefix} \${buildDocumentNumber(requestId)}\`;
}

export function buildRedisSessionKey(tgUserId: string): string {
  return \`\${campaign.storageNamespace}:sess:\${tgUserId}\`;
}

export function buildRedisVariantKey(requestId: string, idx: number): string {
  return \`\${campaign.storageNamespace}:req:\${requestId}:v:\${idx}\`;
}

export function table(tableName: string): string {
  return \`\${campaign.databaseSchema}.\${tableName}\`;
}
`
);

writeFile(
  join(campaignDir, "texts.ts"),
  `import type { CampaignTexts } from "../campaign-definition.js";

function header(): string {
  return "Bureau ${title}";
}

export const texts: CampaignTexts = {
  buttons: {
    chooseAnotherVariant: "Choose another variant",
    continueCurrentRequest: "Continue request",
    continuePayment: "Continue payment",
    goToSeal: "Proceed",
    pay149: "Approve - 149 RUB",
    pay199: "Approve + scheduled delivery - 199 RUB",
    payNow: "Pay",
    pickVariant: (idx) => \`Variant \${idx}\`,
    prepareDocument: "Prepare document",
    prepareNextVariant: "Prepare another variant",
    restart: "Start over",
    setTimezone: "Timezone: not set",
    timezoneValue: (timezone) => \`Timezone: \${timezone}\`
  },
  prompts: {
    buttonsOnly: "Use the buttons below.",
    chooseAction: \`\${header()}\\n\\nChoose an action.\`,
    chooseDeliveryMethod: \`\${header()}\\n\\nChoose delivery mode.\`,
    chooseTimezone: \`\${header()}\\n\\nChoose your timezone.\`,
    deliveryManualSaved: "Delivery mode saved. You can continue.",
    emailSaved: \`\${header()}\\n\\nEmail saved. You can continue.\`,
    enterDeliveryUsername: "Enter recipient username, for example @user.",
    enterEmail: \`\${header()}\\n\\nEnter email for the receipt.\`,
    enterRecipientName: \`\${header()}\\n\\nEnter recipient name.\`,
    noActiveRequest: "No active request found. Start over.",
    paymentNeedsRequest: "Start a request before payment.",
    paymentNeedsVariant: "Choose a variant before payment.",
    preparedPayment: (url) => \`Payment is ready. Open the link:\\n\${url}\`,
    preparingDocument: "Request registered. Preparing the document.",
    resumeNeedsRecipient: "Continue current request. Enter recipient name.",
    resumePreparing: "Continue current request. Preparing the document.",
    sealExpired: \`\${header()}\\n\\nVariant storage expired. Prepare again.\`,
    sealMissing: (idx, available) =>
      \`\${header()}\\n\\nVariant #\${idx} is not ready yet. Available: \${available}.\`,
    selectVariantBeforePayment: "Choose a variant before payment.",
    timezoneSaved: "Timezone saved.",
    timezoneSavedTariff: "Timezone saved. Continue with tariff selection."
  },
  variant: {
    availability: (remaining) =>
      remaining > 0 ? \`Remaining variants: \${remaining}.\\n\\n\` : "No more variants left.\\n\\n",
    noVariantsYet: \`\${header()}\\n\\nPrepare at least one variant first.\`,
    prepared: (idx, remaining) =>
      \`\${header()}\\n\\nVariant #\${idx} is ready.\\n\${remaining > 0 ? \`Remaining variants: \${remaining}.\\n\\n\` : "\\n"}\`,
    sealChoicePartial: (count) =>
      \`\${header()}\\n\\nChoose one of \${count} prepared variants or generate one more.\`,
    sealChoiceFull: \`\${header()}\\n\\nVariant generation is complete. Choose a variant.\`,
    selected: (idx) => \`\${header()}\\n\\nVariant #\${idx} selected.\`
  }
};
`
);

writeFile(
  join(campaignDir, "rules.ts"),
  `import type { CampaignRules } from "../campaign-definition.js";

export const rules: CampaignRules = {
  defaultDeliveryTimezone: "Europe/Moscow",
  timezoneOffsets: {
    "Europe/Moscow": 3
  },
  timezoneOptions: [
    {
      label: "Moscow (UTC+3)",
      timezone: "Europe/Moscow",
      callbackData: "TZ:Europe/Moscow"
    }
  ],
  tariffs: {
    "149": {
      amount: 149,
      requiresDeliveryChoice: false,
      requiresTimezone: false
    },
    "199": {
      amount: 199,
      requiresDeliveryChoice: true,
      requiresTimezone: true
    }
  }
};
`
);

writeFile(
  join(campaignDir, "variants.ts"),
  `import type { CampaignVariants } from "../campaign-definition.js";

export const variants: CampaignVariants = {
  backgrounds: ["bg1.png"],
  templates: {
    t01: {
      sealPresets: [{ x: 920, y: 1820, rot: -8, scale: 0.82, opacity: 0.78 }],
      stampPresets: [{ x: 220, y: 1900, rot: 10, scale: 0.9, opacity: 0.9 }]
    }
  }
};
`
);

writeFile(
  join(campaignDir, "renderer.ts"),
  `import { campaign, buildDocumentNumber, buildDocumentSubtitle } from "./config.js";

export function buildRenderPayload(input: {
  docNo?: string;
  intro?: string;
  outputPath?: string;
  points?: string[];
  recipientName?: string;
  requestId: string;
  templatesDir?: string;
}): Record<string, unknown> {
  const docNo = input.docNo ?? buildDocumentNumber(input.requestId);

  return {
    doc_no: docNo,
    footer_lines: ["Effective immediately.", "No appeal allowed."],
    header_small: campaign.document.headerSmall,
    intro: input.intro,
    output_path: input.outputPath,
    points: input.points,
    qr_url: campaign.telegram.qrUrl,
    recipient_name: input.recipientName,
    source_line: campaign.document.sourceLine,
    subtitle: buildDocumentSubtitle(input.requestId),
    templates_dir: input.templatesDir ?? campaign.renderer.templatesDir,
    title: campaign.document.title,
    watermark_lines: ["Preview.", "Not approved yet."]
  };
}
`
);

writeFile(
  join(campaignDir, "index.ts"),
  `import { defineCampaign } from "../define-campaign.js";
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

export const ${exportName} = defineCampaign({
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
`
);

console.log("");
console.log(`Campaign scaffold created: src/campaigns/${campaignId}`);
console.log("Next steps:");
console.log(`1. Replace placeholders in src/campaigns/${campaignId}/config.ts`);
console.log(`2. Rewrite copy in src/campaigns/${campaignId}/texts.ts`);
console.log(`3. Set tariffs/timezones in src/campaigns/${campaignId}/rules.ts`);
console.log(`4. Add backgrounds/templates in src/campaigns/${campaignId}/variants.ts`);
console.log(`5. Register the campaign in src/campaigns/campaign-registry.ts`);
console.log("6. Add a bot runtime pointing to the new campaignId");

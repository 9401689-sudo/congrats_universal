import type { BotSession } from "../../domain/session.js";
import type { RequestRecord } from "../../domain/request.js";
import type { VariantSnapshot } from "../../domain/variant.js";
import { currentCampaign, currentCampaignVariants } from "../../campaigns/active-campaign.js";
export function buildPreviewVariant(input: {
  request: RequestRecord;
  session: BotSession;
  targetIdx: number;
}): VariantSnapshot {
  const requestId = input.request.id;
  const recipientName = input.request.recipientName ?? input.session.recipientName ?? "Получатель";
  const initiatorName = input.session.tgFirstName ?? "Инициатор";
  const seed = `${requestId}:v:${input.targetIdx}`;

  const templateKeys = Object.keys(currentCampaignVariants.templates) as Array<
    keyof typeof currentCampaignVariants.templates
  >;
  const templateId = pickDeterministic(templateKeys, `${seed}:tpl`);
  const template = currentCampaignVariants.templates[templateId];
  const seal = pickDeterministic(template.sealPresets, `${seed}:seal`);
  const stamp = pickDeterministic(template.stampPresets, `${seed}:stamp`);
  const bg = pickDeterministic(currentCampaignVariants.backgrounds, `${seed}:bg`);
  const intro = pickDeterministic(currentCampaign.document.introOptions, `${seed}:intro`);
  const points = sampleDeterministic(currentCampaign.document.pointsPool, `${seed}:points`, 8);

  return {
    bg,
    content: {
      intro,
      points
    },
    idx: input.targetIdx,
    initiatorName,
    layout: {
      seal,
      stamp
    },
    meta: {
      assetsVersion: currentCampaign.document.assetsVersion,
      createdAt: Math.floor(Date.now() / 1000),
      engineVersion: currentCampaign.document.engineVersion
    },
    recipientName,
    templateId
  };
}

function simpleHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickDeterministic<T>(values: readonly T[], seed: string): T {
  return values[simpleHash(seed) % values.length]!;
}

function sampleDeterministic<T>(values: readonly T[], seed: string, count: number): T[] {
  const pool = [...values];
  let hash = simpleHash(seed);

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = hash % (index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!];
    hash = (hash * 1103515245 + 12345) >>> 0;
  }

  return pool.slice(0, Math.min(count, pool.length));
}

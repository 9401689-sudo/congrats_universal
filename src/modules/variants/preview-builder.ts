import type { BotSession } from "../../domain/session.js";
import type { RequestRecord } from "../../domain/request.js";
import type { VariantSnapshot } from "../../domain/variant.js";

const ENGINE_VERSION = "engine-1";
const ASSETS_VERSION = "assets-2026-02";
type LayoutPreset = {
  opacity: number;
  rot: number;
  scale: number;
  x: number;
  y: number;
};

type TemplatePreset = {
  sealPresets: readonly LayoutPreset[];
  stampPresets: readonly LayoutPreset[];
};

const TEMPLATE_REGISTRY: Record<string, TemplatePreset> = {
  t01: {
    sealPresets: [
      { x: 920, y: 1820, rot: -8, scale: 0.82, opacity: 0.78 },
      { x: 980, y: 1880, rot: -12, scale: 0.82, opacity: 0.8 },
      { x: 1040, y: 1860, rot: -6, scale: 0.82, opacity: 0.76 }
    ],
    stampPresets: [
      { x: 220, y: 1900, rot: 10, scale: 0.9, opacity: 0.9 },
      { x: 260, y: 1980, rot: 8, scale: 0.9, opacity: 0.88 },
      { x: 320, y: 1940, rot: 14, scale: 0.9, opacity: 0.92 }
    ]
  },
  t02: {
    sealPresets: [
      { x: 980, y: 1840, rot: -10, scale: 0.82, opacity: 0.78 },
      { x: 1040, y: 1900, rot: -15, scale: 0.82, opacity: 0.8 }
    ],
    stampPresets: [
      { x: 240, y: 1920, rot: 10, scale: 0.9, opacity: 0.9 },
      { x: 300, y: 2000, rot: 6, scale: 0.9, opacity: 0.88 }
    ]
  },
  t03: {
    sealPresets: [
      { x: 1000, y: 1860, rot: -5, scale: 0.82, opacity: 0.76 },
      { x: 920, y: 1820, rot: -9, scale: 0.82, opacity: 0.8 }
    ],
    stampPresets: [
      { x: 260, y: 1960, rot: 16, scale: 0.9, opacity: 0.92 },
      { x: 320, y: 2020, rot: 12, scale: 0.9, opacity: 0.9 }
    ]
  }
};

const DEFAULT_BACKGROUNDS = ["bg1.png", "bg2.png", "bg3.png", "bg4.png", "bg5.png", "bg6.png"];
const DEFAULT_INTROS = [
  "Настоящим разрешается:",
  "По итогам рассмотрения разрешается:",
  "Бюро постановляет:"
];
const DEFAULT_POINTS = [
  "Принимать поздравления без ограничений.",
  "Не отвечать на лишние сообщения до особого распоряжения.",
  "Сохранять торжественное выражение лица.",
  "Требовать комплименты в разумном объеме.",
  "Игнорировать мелкие недоразумения текущего дня.",
  "Принимать сладкое и цветы без объяснений.",
  "Объявлять сегодняшний день особым случаем.",
  "Считать хорошее настроение обязательным к исполнению.",
  "Допускать праздничные послабления режима.",
  "Разрешать себе лучшие сценарии вечера."
];

export function buildPreviewVariant(input: {
  request: RequestRecord;
  session: BotSession;
  targetIdx: number;
}): VariantSnapshot {
  const requestId = input.request.id;
  const recipientName = input.request.recipientName ?? input.session.recipientName ?? "Получатель";
  const initiatorName = input.session.tgFirstName ?? "Инициатор";
  const seed = `${requestId}:v:${input.targetIdx}`;

  const templateKeys = Object.keys(TEMPLATE_REGISTRY) as Array<keyof typeof TEMPLATE_REGISTRY>;
  const templateId = pickDeterministic(templateKeys, `${seed}:tpl`);
  const template = TEMPLATE_REGISTRY[templateId];
  const seal = pickDeterministic(template.sealPresets, `${seed}:seal`);
  const stamp = pickDeterministic(template.stampPresets, `${seed}:stamp`);
  const bg = pickDeterministic(DEFAULT_BACKGROUNDS, `${seed}:bg`);
  const intro = pickDeterministic(DEFAULT_INTROS, `${seed}:intro`);
  const points = sampleDeterministic(DEFAULT_POINTS, `${seed}:points`, 8);

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
      assetsVersion: ASSETS_VERSION,
      createdAt: Math.floor(Date.now() / 1000),
      engineVersion: ENGINE_VERSION
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

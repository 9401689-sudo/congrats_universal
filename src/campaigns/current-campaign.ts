export type CurrentCampaign = {
  brand: {
    bureauName: string;
    paymentItemDescription: string;
  };
  databaseSchema: string;
  document: {
    assetsVersion: string;
    defaultDocNumber: string;
    engineVersion: string;
    headerSmall: string;
    introOptions: readonly string[];
    numberPrefix: string;
    pointsPool: readonly string[];
    sourceLine: string;
    subtitlePrefix: string;
    title: string;
  };
  id: string;
  renderer: {
    templatesDir: string;
  };
  storageNamespace: string;
  telegram: {
    botUsername: string;
    qrUrl: string;
  };
};

export const currentCampaign: CurrentCampaign = {
  brand: {
    bureauName: "Бюро «Разрешено»",
    paymentItemDescription: "Электронная открытка (Бюро Разрешено)"
  },
  databaseSchema: "razreshenobot",
  document: {
    assetsVersion: "assets-2026-02",
    defaultDocNumber: "0803-000",
    engineVersion: "engine-1",
    headerSmall: "Специальный выпуск к 8 марта\nРегламентирующая инстанция «РАЗРЕШЕНО»",
    introOptions: [
      "Настоящим разрешается:",
      "По итогам рассмотрения разрешается:",
      "Бюро постановляет:"
    ],
    numberPrefix: "0803",
    pointsPool: [
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
    ],
    sourceLine: "Источник оформления: razresheno",
    subtitlePrefix: "ОФИЦИАЛЬНЫЙ ДОКУМЕНТ №",
    title: "РАЗРЕШЕНО"
  },
  id: "march8-razresheno",
  renderer: {
    templatesDir: "/mnt/razresheno/templates"
  },
  storageNamespace: "razresheno",
  telegram: {
    botUsername: "razresheno_buro_bot",
    qrUrl: "https://t.me/razresheno_buro_bot"
  }
};

export function buildCampaignDocumentNumber(requestId: string): string {
  return `${currentCampaign.document.numberPrefix}-${requestId.padStart(3, "0")}`;
}

export function buildCampaignDocumentSubtitle(requestId: string): string {
  return `${currentCampaign.document.subtitlePrefix} ${buildCampaignDocumentNumber(requestId)}`;
}

export function buildCampaignRedisSessionKey(tgUserId: string): string {
  return `${currentCampaign.storageNamespace}:sess:${tgUserId}`;
}

export function buildCampaignRedisVariantKey(requestId: string, idx: number): string {
  return `${currentCampaign.storageNamespace}:req:${requestId}:v:${idx}`;
}

export function campaignTable(tableName: string): string {
  return `${currentCampaign.databaseSchema}.${tableName}`;
}

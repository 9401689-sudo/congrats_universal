export type CampaignTariffRule = {
  amount: number;
  requiresDeliveryChoice: boolean;
  requiresTimezone: boolean;
};

export type CampaignTariff = "149" | "199";

export type CampaignTimezoneOption = {
  callbackData: string;
  label: string;
  timezone: string;
};

export type CampaignConfig = {
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

export type CampaignTexts = {
  buttons: {
    chooseAnotherVariant: string;
    continueCurrentRequest: string;
    continuePayment: string;
    goToSeal: string;
    pay149: string;
    pay199: string;
    payNow: string;
    pickVariant: (idx: number) => string;
    prepareDocument: string;
    prepareNextVariant: string;
    restart: string;
    setTimezone: string;
    timezoneValue: (timezone: string) => string;
  };
  prompts: {
    aboutBureau: string;
    buttonsOnly: string;
    chooseAction: string;
    chooseDeliveryMethod: string;
    chooseTimezone: string;
    deliveryManualSaved: string;
    emailSaved: string;
    enterDeliveryUsername: string;
    enterEmail: string;
    enterRecipientName: string;
    noActiveRequest: string;
    paymentNeedsRequest: string;
    paymentNeedsVariant: string;
    preparedPayment: (url: string) => string;
    preparingDocument: string;
    resumeNeedsRecipient: string;
    resumePreparing: string;
    sealExpired: string;
    sealMissing: (idx: number, available: number) => string;
    selectVariantBeforePayment: string;
    timezoneSaved: string;
    timezoneSavedTariff: string;
  };
  variant: {
    availability: (remaining: number) => string;
    noVariantsYet: string;
    prepared: (idx: number, remaining: number) => string;
    sealChoicePartial: (count: number) => string;
    sealChoiceFull: string;
    selected: (idx: number) => string;
  };
};

export type CampaignRules = {
  defaultDeliveryTimezone: string;
  timezoneOffsets: Record<string, number>;
  timezoneOptions: readonly CampaignTimezoneOption[];
  tariffs: Record<CampaignTariff, CampaignTariffRule>;
};

export type CampaignLayoutPreset = {
  opacity: number;
  rot: number;
  scale: number;
  x: number;
  y: number;
};

export type CampaignTemplatePreset = {
  sealPresets: readonly CampaignLayoutPreset[];
  stampPresets: readonly CampaignLayoutPreset[];
};

export type CampaignVariants = {
  backgrounds: readonly string[];
  templates: Record<string, CampaignTemplatePreset>;
};

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

export type CampaignTariff = "149" | "199";

export type CampaignTimezoneOption = {
  callbackData: string;
  label: string;
  timezone: string;
};

export const currentCampaignRules: {
  defaultDeliveryTimezone: string;
  timezoneOffsets: Record<string, number>;
  timezoneOptions: readonly CampaignTimezoneOption[];
  tariffs: Record<
    CampaignTariff,
    { amount: number; requiresDeliveryChoice: boolean; requiresTimezone: boolean }
  >;
} = {
  defaultDeliveryTimezone: "Europe/Moscow",
  timezoneOffsets: {
    "Asia/Irkutsk": 8,
    "Asia/Krasnoyarsk": 7,
    "Asia/Omsk": 6,
    "Asia/Vladivostok": 10,
    "Asia/Yakutsk": 9,
    "Asia/Yekaterinburg": 5,
    "Europe/Moscow": 3
  },
  timezoneOptions: [
    { label: "MSK (UTC+3)", timezone: "Europe/Moscow", callbackData: "TZ:Europe/Moscow" },
    {
      label: "Екатеринбург (UTC+5)",
      timezone: "Asia/Yekaterinburg",
      callbackData: "TZ:Asia/Yekaterinburg"
    },
    { label: "Омск (UTC+6)", timezone: "Asia/Omsk", callbackData: "TZ:Asia/Omsk" },
    {
      label: "Красноярск (UTC+7)",
      timezone: "Asia/Krasnoyarsk",
      callbackData: "TZ:Asia/Krasnoyarsk"
    },
    { label: "Иркутск (UTC+8)", timezone: "Asia/Irkutsk", callbackData: "TZ:Asia/Irkutsk" },
    { label: "Якутск (UTC+9)", timezone: "Asia/Yakutsk", callbackData: "TZ:Asia/Yakutsk" },
    {
      label: "Владивосток (UTC+10)",
      timezone: "Asia/Vladivostok",
      callbackData: "TZ:Asia/Vladivostok"
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

export function isCampaignTariff(value: unknown): value is CampaignTariff {
  return value === "149" || value === "199";
}

export function getCampaignTariffAmount(tariff: CampaignTariff): number {
  return currentCampaignRules.tariffs[tariff].amount;
}

export function campaignTimezoneKeyboard(): Array<Array<{ callback_data: string; text: string }>> {
  return [
    [
      {
        text: currentCampaignRules.timezoneOptions[0].label,
        callback_data: currentCampaignRules.timezoneOptions[0].callbackData
      }
    ],
    currentCampaignRules.timezoneOptions.slice(1, 3).map((option) => ({
      text: option.label,
      callback_data: option.callbackData
    })),
    currentCampaignRules.timezoneOptions.slice(3, 5).map((option) => ({
      text: option.label,
      callback_data: option.callbackData
    })),
    currentCampaignRules.timezoneOptions.slice(5, 7).map((option) => ({
      text: option.label,
      callback_data: option.callbackData
    }))
  ];
}

export function computeCampaignScheduledAt(timezone: string): string {
  const offset =
    currentCampaignRules.timezoneOffsets[
      timezone as keyof typeof currentCampaignRules.timezoneOffsets
    ] ?? currentCampaignRules.timezoneOffsets[currentCampaignRules.defaultDeliveryTimezone];

  const now = new Date();
  const targetYear =
    now.getUTCMonth() > 2 || (now.getUTCMonth() === 2 && now.getUTCDate() > 8)
      ? now.getUTCFullYear() + 1
      : now.getUTCFullYear();

  return new Date(Date.UTC(targetYear, 2, 8, 9 - offset, 0, 0)).toISOString();
}

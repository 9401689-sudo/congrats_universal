import { currentCampaign } from "./current-campaign.js";

function bureauHeader(): string {
  return `🏛 ${currentCampaign.brand.bureauName}`;
}

export const currentCampaignTexts = {
  buttons: {
    chooseAnotherVariant: "Выбрать другой вариант",
    continueCurrentRequest: "Продолжить обращение",
    continuePayment: "💳 Продолжить оплату",
    goToSeal: "Перейти к заверению",
    pay149: "Заверить — 149 ₽",
    pay199: "Заверить + направить 8 марта с 9:00 до 9:30 — 199 ₽",
    payNow: "💳 Оплатить",
    pickVariant: (idx: number) => `Вариант ${idx}`,
    prepareDocument: "Подготовить документ",
    prepareNextVariant: "Подготовить другой вариант",
    restart: "Начать заново",
    setTimezone: "Часовой пояс: не установлен. Установить?",
    timezoneValue: (timezone: string) => `Часовой пояс: ${timezone}. Сменить?`
  },
  prompts: {
    buttonsOnly: "Сейчас управление осуществляется кнопками.",
    chooseAction: `${bureauHeader()}\n\nВыберите дальнейшее действие.`,
    chooseDeliveryMethod:
      `${bureauHeader()} \n\nВыберите способ вручения 8 марта.\n` +
      "Бот не пишет получателю напрямую.",
    chooseTimezone:
      `${bureauHeader()} \n\nДля тарифа «Заверить + направить» документ будет ` +
      "отправлен 8 марта с 09:00 (в течение нескольких минут) по вашему времени.\n\n" +
      "Выберите ваш часовой пояс:",
    deliveryManualSaved: "Способ вручения сохранен. Можно продолжить оплату.",
    emailSaved: `${bureauHeader()}\n\nEmail сохранен. Можно продолжить оплату.`,
    enterDeliveryUsername:
      "Укажите @username получателя (пример: @ivan_ivanov).\n\n" +
      "Бот не напишет ему напрямую — 8 марта мы пришлем вам PNG и кнопку открытия чата.",
    enterEmail:
      `${bureauHeader()}\n\nУкажите email для отправки чека. ` +
      "Это обязательное условие для оплаты.\nПример: name@example.com",
    enterRecipientName: `${bureauHeader()}\n\nУкажите имя получателя.`,
    noActiveRequest: "Активное обращение не найдено. Начните заново.",
    paymentNeedsRequest: "Перед оплатой нужно начать обращение заново.",
    paymentNeedsVariant: "Перед оплатой нужно выбрать вариант для заверения.",
    preparedPayment: (url: string) => `Оплата подготовлена. Нажмите кнопку ниже:\n${url}`,
    preparingDocument: "Обращение зарегистрировано. Подготовка документа займет около минуты.",
    resumeNeedsRecipient: "Продолжаем текущее обращение. Укажите имя получателя.",
    resumePreparing: "Продолжаем текущее обращение. Подготавливаю документ.",
    sealExpired:
      `${bureauHeader()} \nСрок хранения варианта истек.\nПодготовьте документ заново.`,
    sealMissing: (idx: number, available: number) =>
      `${bureauHeader()} \n\nВариант №${idx} еще не подготовлен.\n\n` +
      `Сейчас доступно вариантов: ${available}.`,
    selectVariantBeforePayment: "Перед оплатой нужно выбрать вариант для заверения.",
    timezoneSaved: "Часовой пояс сохранен.",
    timezoneSavedTariff: "Часовой пояс сохранен. Можно продолжить выбор тарифа."
  },
  variant: {
    availability: (remaining: number) =>
      remaining === 2
        ? "Осталось 2 варианта в рамках текущего обращения.\n\n"
        : remaining === 1
          ? "Остался 1 вариант в рамках текущего обращения.\n\n"
          : "Подготовка вариантов в рамках текущего обращения завершена.\n\n",
    noVariantsYet: `${bureauHeader()}\n\nСначала подготовьте хотя бы один вариант.`,
    prepared: (idx: number, remaining: number) =>
      `${bureauHeader()}\n\nПодготовлен вариант №${idx}.\n` +
      currentCampaignTexts.variant.availability(remaining) +
      "Вступает в силу немедленно.\nОбжалованию не подлежит.",
    sealChoicePartial: (count: number) =>
      `${bureauHeader()}\n\nДля вступления документа в силу требуется заверение.\n\n` +
      `Сейчас подготовлено вариантов: ${count}.\n` +
      "Выберите вариант для заверения или подготовьте еще один.",
    sealChoiceFull:
      `${bureauHeader()}\n\nДля вступления документа в силу требуется заверение.\n\n` +
      "Подготовка вариантов завершена.\nУкажите вариант, подлежащий заверению.",
    selected: (idx: number) =>
      `${bureauHeader()} \n\nВыбран вариант №${idx}.\n\n` +
      "Для вступления документа в силу требуется заверение.\n\n" +
      "Вступает в силу немедленно.\nОбжалованию не подлежит."
  }
};

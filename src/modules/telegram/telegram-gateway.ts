export interface TelegramGateway {
  sendMessage(input: {
    chatId: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
    text: string;
  }): Promise<string | null>;

  sendPhoto(input: {
    chatId: string;
    photoPath: string;
    caption?: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ callback_data?: string; text: string; url?: string }>>;
    };
  }): Promise<string | null>;

  clearInlineKeyboard(input: { chatId: string; messageId: string }): Promise<void>;

  deleteMessage(input: { chatId: string; messageId: string }): Promise<void>;
}

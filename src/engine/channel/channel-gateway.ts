export type ChannelButton = {
  callback_data?: string;
  text: string;
  url?: string;
};

export type ChannelReplyMarkup = {
  inline_keyboard: Array<Array<ChannelButton>>;
};

export type SendChannelMessageInput = {
  chatId: string;
  preserveInlineKeyboard?: boolean;
  replyMarkup?: ChannelReplyMarkup;
  stickyInlineKeyboard?: boolean;
  text: string;
};

export type SendChannelPhotoInput = {
  caption?: string;
  chatId: string;
  photoPath: string;
  replyMarkup?: ChannelReplyMarkup;
};

export interface ChannelGateway {
  sendMessage(input: SendChannelMessageInput): Promise<string | null>;
  sendPhoto(input: SendChannelPhotoInput): Promise<string | null>;
  clearInlineKeyboard(input: { chatId: string; messageId: string }): Promise<void>;
  deleteMessage(input: { chatId: string; messageId: string }): Promise<void>;
}

export interface DeliveryTransport {
  sendDocument(input: {
    caption: string;
    chatId: string;
    fileId?: string;
    renderedPath?: string;
  }): Promise<{ fileId: string }>;
}

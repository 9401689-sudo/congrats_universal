import type { RequestRecord } from "../../domain/request.js";

export interface RequestsRepository {
  closeCompletedRequest(requestId: string): Promise<void>;
  createOpenRequest(userId: number): Promise<RequestRecord>;
  closeOpenRequest(requestId: string): Promise<void>;
  findLatestOpenByTelegramUserId(tgUserId: string): Promise<RequestRecord | null>;
  getById(requestId: string): Promise<RequestRecord | null>;
  setDeliveryManual(requestId: string): Promise<void>;
  setDeliveryUsername(requestId: string, username: string): Promise<void>;
  setInitiatorTimezone(requestId: string, timezone: string): Promise<void>;
  setSelectedVariant(requestId: string, selectedVariantIdx: number): Promise<void>;
  updateRecipientName(requestId: string, recipientName: string): Promise<RequestRecord>;
}

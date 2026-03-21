import type { DeliveryContext, DeliveryRecord } from "../../domain/delivery.js";

export interface DeliveriesRepository {
  createScheduledDelivery(input: {
    deliveryMethod: "manual" | "username";
    documentId: string;
    recipientUsername: string | null;
    scheduledAt: string;
  }): Promise<DeliveryRecord>;
  getContext(deliveryId: string): Promise<DeliveryContext | null>;
  listDueDeliveryIds(limit: number): Promise<string[]>;
  markSent(deliveryId: string): Promise<void>;
  tryLock(deliveryId: string, owner: string): Promise<boolean>;
}

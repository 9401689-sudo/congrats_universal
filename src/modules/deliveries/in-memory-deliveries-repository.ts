import type { DeliveryContext, DeliveryRecord } from "../../domain/delivery.js";
import type { DeliveriesRepository } from "./deliveries-repository.js";

export class InMemoryDeliveriesRepository implements DeliveriesRepository {
  private seq = 1;
  private readonly deliveries = new Map<string, DeliveryRecord>();

  async createScheduledDelivery(input: {
    deliveryMethod: "manual" | "username";
    documentId: string;
    recipientUsername: string | null;
    scheduledAt: string;
  }): Promise<DeliveryRecord> {
    const created: DeliveryRecord = {
      deliveryMethod: input.deliveryMethod,
      documentId: input.documentId,
      id: String(this.seq++),
      recipientUsername: input.recipientUsername,
      scheduledAt: input.scheduledAt
    };
    this.deliveries.set(created.id, created);
    return created;
  }

  async getContext(deliveryId: string): Promise<DeliveryContext | null> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      return null;
    }

    return {
      deliveryId: delivery.id,
      deliveryMethod: delivery.deliveryMethod,
      documentId: delivery.documentId,
      finalFileId: null,
      renderParams: {},
      requestId: "unknown",
      tgUserId: "0"
    };
  }

  async listDueDeliveryIds(limit: number): Promise<string[]> {
    return [...this.deliveries.keys()].slice(0, limit);
  }

  async markSent(deliveryId: string): Promise<void> {
    this.deliveries.delete(deliveryId);
  }

  async tryLock(_deliveryId: string, _owner: string): Promise<boolean> {
    return true;
  }
}

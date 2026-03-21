import type { RequestRecord } from "../../domain/request.js";
import type { RequestsRepository } from "../../engine/repositories/requests-repository.js";

export class InMemoryRequestsRepository implements RequestsRepository {
  private seq = 1;
  private readonly requests = new Map<
    string,
    RequestRecord & { userId: number; status: string }
  >();
  private readonly tgUserToUserId = new Map<string, number>();

  bindTelegramUser(tgUserId: string, userId: number): void {
    this.tgUserToUserId.set(tgUserId, userId);
  }

  async createOpenRequest(userId: number): Promise<RequestRecord> {
    const id = String(this.seq++);
    const created = {
      deliveryMethod: null,
      deliveryUsername: null,
      id,
      initiatorTimezone: null,
      recipientName: null,
      selectedVariantIdx: null,
      status: "open",
      userId
    };
    this.requests.set(id, created);
    return created;
  }

  async closeCompletedRequest(requestId: string): Promise<void> {
    const existing = this.requests.get(requestId);
    if (existing) {
      existing.status = "closed";
      this.requests.set(requestId, existing);
    }
  }

  async closeOpenRequest(requestId: string): Promise<void> {
    const existing = this.requests.get(requestId);
    if (existing) {
      existing.status = "cancelled";
      this.requests.set(requestId, existing);
    }
  }

  async findLatestOpenByTelegramUserId(tgUserId: string): Promise<RequestRecord | null> {
    const userId = this.tgUserToUserId.get(tgUserId);
    if (!userId) {
      return null;
    }

    const openRequests = [...this.requests.values()]
      .filter((request) => request.userId === userId && request.status === "open")
      .sort((left, right) => Number(right.id) - Number(left.id));

    return openRequests[0] ?? null;
  }

  async getById(requestId: string): Promise<RequestRecord | null> {
    return this.requests.get(requestId) ?? null;
  }

  async setDeliveryManual(requestId: string): Promise<void> {
    const existing = this.requests.get(requestId);
    if (!existing) throw new Error(`Request not found: ${requestId}`);
    existing.deliveryMethod = "manual";
    existing.deliveryUsername = null;
    this.requests.set(requestId, existing);
  }

  async setDeliveryUsername(requestId: string, username: string): Promise<void> {
    const existing = this.requests.get(requestId);
    if (!existing) throw new Error(`Request not found: ${requestId}`);
    existing.deliveryMethod = "username";
    existing.deliveryUsername = username;
    this.requests.set(requestId, existing);
  }

  async setInitiatorTimezone(requestId: string, timezone: string): Promise<void> {
    const existing = this.requests.get(requestId);
    if (!existing) throw new Error(`Request not found: ${requestId}`);
    existing.initiatorTimezone = timezone;
    this.requests.set(requestId, existing);
  }

  async setSelectedVariant(requestId: string, selectedVariantIdx: number): Promise<void> {
    const existing = this.requests.get(requestId);
    if (!existing) throw new Error(`Request not found: ${requestId}`);
    existing.selectedVariantIdx = selectedVariantIdx;
    this.requests.set(requestId, existing);
  }

  async updateRecipientName(requestId: string, recipientName: string): Promise<RequestRecord> {
    const existing = this.requests.get(requestId);
    if (!existing) {
      throw new Error(`Request not found: ${requestId}`);
    }

    existing.recipientName = recipientName;
    this.requests.set(requestId, existing);
    return existing;
  }
}

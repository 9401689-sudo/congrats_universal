import type { PaymentRecord } from "../../domain/payment.js";
import type { PaymentsRepository } from "../../engine/payments/payments-repository.js";

export class InMemoryPaymentsRepository implements PaymentsRepository {
  private seq = 1;
  private readonly payments = new Map<string, PaymentRecord>();

  async findByProviderPaymentId(providerPaymentId: string): Promise<PaymentRecord | null> {
    return this.payments.get(providerPaymentId) ?? null;
  }

  async insertPendingPayment(input: {
    amount: number;
    idempotenceKey: string;
    payload: Record<string, unknown>;
    providerPaymentId: string;
    requestId: string;
    tariff: "149" | "199";
  }): Promise<PaymentRecord> {
    const record = {
      amount: input.amount,
      id: String(this.seq++),
      providerPaymentId: input.providerPaymentId,
      requestId: input.requestId,
      tariff: input.tariff
    };
    this.payments.set(input.providerPaymentId, record);
    return record;
  }

  async markCanceled(_providerPaymentId: string): Promise<void> {}

  async upsertPaid(input: {
    providerPaymentId: string;
    requestId: string;
    tariff: "149" | "199";
    tgUserId: string;
  }): Promise<PaymentRecord> {
    const existing = this.payments.get(input.providerPaymentId);
    if (existing) return existing;

    const created: PaymentRecord = {
      amount: input.tariff === "149" ? 149 : 199,
      id: String(this.seq++),
      providerPaymentId: input.providerPaymentId,
      requestId: input.requestId,
      tariff: input.tariff
    };
    this.payments.set(input.providerPaymentId, created);
    return created;
  }
}

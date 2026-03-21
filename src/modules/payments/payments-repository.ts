import type { PaymentRecord } from "../../domain/payment.js";

export interface PaymentsRepository {
  findByProviderPaymentId(providerPaymentId: string): Promise<PaymentRecord | null>;
  insertPendingPayment(input: {
    amount: number;
    idempotenceKey: string;
    payload: Record<string, unknown>;
    providerPaymentId: string;
    requestId: string;
    tariff: "149" | "199";
  }): Promise<PaymentRecord>;
  markCanceled(providerPaymentId: string): Promise<void>;
  upsertPaid(input: {
    providerPaymentId: string;
    requestId: string;
    tariff: "149" | "199";
    tgUserId: string;
  }): Promise<PaymentRecord>;
}

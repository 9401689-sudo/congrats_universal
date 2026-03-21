export type CreatePaymentInput = {
  customerEmail: string;
  idempotenceKey: string;
  requestId: string;
  tariff: "149" | "199";
  tgUserId: string;
};

export type CreatePaymentResult = {
  confirmationUrl: string;
  idempotenceKey: string;
  providerPaymentId: string;
};

export interface PaymentService {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

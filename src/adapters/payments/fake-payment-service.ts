import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentService
} from "../../engine/payments/payment-service.js";

export class FakePaymentService implements PaymentService {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      confirmationUrl: `https://example.test/pay/${input.requestId}/${input.tariff}`,
      idempotenceKey: input.idempotenceKey,
      providerPaymentId: `fake_${input.requestId}_${input.tariff}`
    };
  }
}

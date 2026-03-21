import { currentCampaign } from "../../campaigns/current-campaign.js";
import type { CreatePaymentInput, CreatePaymentResult, PaymentService } from "./payment-service.js";

export class YookassaPaymentService implements PaymentService {
  constructor(
    private readonly shopId: string,
    private readonly secretKey: string,
    private readonly returnUrl: string
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString("base64")}`,
        "content-type": "application/json",
        "idempotence-key": input.idempotenceKey
      },
      body: JSON.stringify({
        amount: {
          value: input.tariff === "199" ? "199.00" : "149.00",
          currency: "RUB"
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: this.returnUrl
        },
        description: `Электронная открытка №${input.requestId}`,
        metadata: {
          request_id: String(input.requestId),
          tg_user_id: String(input.tgUserId),
          tariff: String(input.tariff)
        },
        receipt: {
          customer: {
            email: input.customerEmail
          },
          items: [
            {
              description: currentCampaign.brand.paymentItemDescription,
              quantity: "1.00",
              amount: {
                value: input.tariff === "199" ? "199.00" : "149.00",
                currency: "RUB"
              },
              vat_code: 1,
              payment_subject: "service",
              payment_mode: "full_payment"
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`YooKassa createPayment failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as {
      confirmation?: { confirmation_url?: string };
      id?: string;
    };

    if (!payload.id || !payload.confirmation?.confirmation_url) {
      throw new Error("YooKassa did not return payment id or confirmation url");
    }

    return {
      confirmationUrl: payload.confirmation.confirmation_url,
      idempotenceKey: input.idempotenceKey,
      providerPaymentId: payload.id
    };
  }
}

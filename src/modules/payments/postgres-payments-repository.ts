import { campaignTable } from "../../campaigns/current-campaign.js";
import type { PaymentRecord } from "../../domain/payment.js";
import type { PostgresExecutor } from "../../infra/postgres.js";
import type { PaymentsRepository } from "../../engine/payments/payments-repository.js";

type PaymentRow = {
  amount?: number;
  id: number | string;
  request_id?: number | string;
};

export class PostgresPaymentsRepository implements PaymentsRepository {
  constructor(private readonly db: PostgresExecutor) {}

  async findByProviderPaymentId(providerPaymentId: string): Promise<PaymentRecord | null> {
    const result = await this.db.query<PaymentRow>(
      `
        select id, request_id, amount
        from ${campaignTable("payments")}
        where provider_payment_charge_id = $1
        limit 1;
      `,
      [providerPaymentId]
    );

    const row = result.rows[0];
    if (!row || row.request_id == null || row.amount == null) {
      return null;
    }

    return {
      amount: Number(row.amount),
      id: String(row.id),
      providerPaymentId,
      requestId: String(row.request_id),
      tariff: Number(row.amount) === 149 ? "149" : "199"
    };
  }

  async insertPendingPayment(input: {
    amount: number;
    idempotenceKey: string;
    payload: Record<string, unknown>;
    providerPaymentId: string;
    requestId: string;
    tariff: "149" | "199";
  }): Promise<PaymentRecord> {
    const result = await this.db.query<PaymentRow>(
      `
        INSERT INTO ${campaignTable("payments")} (
          request_id,
          payload,
          amount,
          provider_payment_charge_id
        )
        VALUES (
          $1::bigint,
          ($2::jsonb || jsonb_build_object(
            'provider', 'yookassa',
            'yk_payment_id', $3::text,
            'idempotence_key', $4::text,
            'tariff', $5::text
          )),
          $6,
          $3::text
        )
        RETURNING id;
      `,
      [
        input.requestId,
        JSON.stringify(input.payload),
        input.providerPaymentId,
        input.idempotenceKey,
        input.tariff,
        input.amount
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to insert pending payment");
    }

    return {
      amount: input.amount,
      id: String(row.id),
      providerPaymentId: input.providerPaymentId,
      requestId: input.requestId,
      tariff: input.tariff
    };
  }

  async markCanceled(providerPaymentId: string): Promise<void> {
    await this.db.query(
      `
        UPDATE ${campaignTable("payments")}
        SET payload = payload || jsonb_build_object('yookassa_event', 'payment.canceled')
        WHERE provider_payment_charge_id = $1;
      `,
      [providerPaymentId]
    );
  }

  async upsertPaid(input: {
    providerPaymentId: string;
    requestId: string;
    tariff: "149" | "199";
    tgUserId: string;
  }): Promise<PaymentRecord> {
    const result = await this.db.query<PaymentRow>(
      `
        INSERT INTO ${campaignTable("payments")} (
          request_id,
          payload,
          amount,
          status,
          paid_at,
          provider_payment_charge_id
        )
        VALUES (
          $1::bigint,
          jsonb_build_object(
            'provider', 'yookassa',
            'yk_payment_id', $2,
            'tariff', $3,
            'tg_user_id', $4
          ),
          $5,
          'paid'::public.payment_status,
          now(),
          $2
        )
        ON CONFLICT (provider_payment_charge_id)
        DO UPDATE SET
          status = 'paid'::public.payment_status,
          paid_at = COALESCE(${campaignTable("payments")}.paid_at, now())
        RETURNING id;
      `,
      [
        input.requestId,
        input.providerPaymentId,
        input.tariff,
        input.tgUserId,
        input.tariff === "149" ? 149 : 199
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert paid payment");
    }

    return {
      amount: input.tariff === "149" ? 149 : 199,
      id: String(row.id),
      providerPaymentId: input.providerPaymentId,
      requestId: input.requestId,
      tariff: input.tariff
    };
  }
}

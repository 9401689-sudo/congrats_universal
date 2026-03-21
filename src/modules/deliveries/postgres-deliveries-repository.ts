import { campaignTable } from "../../campaigns/current-campaign.js";
import type { DeliveryContext, DeliveryRecord } from "../../domain/delivery.js";
import type { PostgresExecutor } from "../../infra/postgres.js";
import type { DeliveriesRepository } from "../../engine/repositories/deliveries-repository.js";

type DeliveryRow = {
  delivery_method: "manual" | "username";
  document_id: number | string;
  id: number | string;
  recipient_username?: string | null;
  scheduled_at: string;
};

type IdRow = {
  id: number | string;
};

type LockRow = {
  locked: boolean;
};

type DeliveryContextRow = {
  delivery_id: number | string;
  delivery_method: "manual" | "username";
  document_id: number | string;
  final_file_id?: string | null;
  render_params?: Record<string, unknown> | null;
  request_id: number | string;
  tg_user_id: number | string;
};

export class PostgresDeliveriesRepository implements DeliveriesRepository {
  constructor(private readonly db: PostgresExecutor) {}

  async createScheduledDelivery(input: {
    deliveryMethod: "manual" | "username";
    documentId: string;
    recipientUsername: string | null;
    scheduledAt: string;
  }): Promise<DeliveryRecord> {
    const result = await this.db.query<DeliveryRow>(
      `
        insert into ${campaignTable("deliveries")}
          (document_id, scheduled_at, delivery_method, recipient_username)
        values
          ($1::bigint, $2::timestamptz, $3::public.delivery_method, $4)
        on conflict (document_id) do nothing
        returning id, document_id, scheduled_at, delivery_method, recipient_username;
      `,
      [input.documentId, input.scheduledAt, input.deliveryMethod, input.recipientUsername]
    );

    const row = result.rows[0];
    if (!row) {
      return {
        deliveryMethod: input.deliveryMethod,
        documentId: input.documentId,
        id: "existing",
        recipientUsername: input.recipientUsername,
        scheduledAt: input.scheduledAt
      };
    }

    return {
      deliveryMethod: row.delivery_method,
      documentId: String(row.document_id),
      id: String(row.id),
      recipientUsername: row.recipient_username ?? null,
      scheduledAt: row.scheduled_at
    };
  }

  async getContext(deliveryId: string): Promise<DeliveryContext | null> {
    const result = await this.db.query<DeliveryContextRow>(
      `
        select
          d.id as delivery_id,
          d.delivery_method,
          d.document_id,
          doc.request_id,
          doc.render_params,
          doc.final_file_id,
          u.tg_user_id
        from ${campaignTable("deliveries")} d
        join ${campaignTable("documents")} doc
          on doc.id = d.document_id
        join ${campaignTable("requests")} r
          on r.id = doc.request_id
        join ${campaignTable("users")} u
          on u.id = r.user_id
        where d.id = $1::bigint
        limit 1;
      `,
      [deliveryId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      deliveryId: String(row.delivery_id),
      deliveryMethod: row.delivery_method,
      documentId: String(row.document_id),
      finalFileId: row.final_file_id ?? null,
      renderParams: row.render_params ?? {},
      requestId: String(row.request_id),
      tgUserId: String(row.tg_user_id)
    };
  }

  async listDueDeliveryIds(limit: number): Promise<string[]> {
    const result = await this.db.query<IdRow>(
      `
        SELECT id
        FROM ${campaignTable("deliveries")}
        WHERE status = 'scheduled'::public.delivery_status
          AND scheduled_at <= now()
          AND attempts < 5
          AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes')
        ORDER BY scheduled_at ASC
        LIMIT $1;
      `,
      [limit]
    );

    return result.rows.map((row) => String(row.id));
  }

  async markSent(deliveryId: string): Promise<void> {
    await this.db.query(
      `
        update ${campaignTable("deliveries")}
        set status = 'sent'::public.delivery_status,
            sent_at = now(),
            locked_at = null,
            lock_owner = null
        where id = $1::bigint;
      `,
      [deliveryId]
    );
  }

  async tryLock(deliveryId: string, owner: string): Promise<boolean> {
    const result = await this.db.query<LockRow>(
      `
        WITH upd AS (
          UPDATE ${campaignTable("deliveries")}
          SET locked_at = now(),
              lock_owner = $2
          WHERE id = $1::bigint
            AND status = 'scheduled'::public.delivery_status
            AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes')
          RETURNING id
        )
        SELECT EXISTS (SELECT 1 FROM upd) AS locked;
      `,
      [deliveryId, owner]
    );

    return Boolean(result.rows[0]?.locked);
  }
}

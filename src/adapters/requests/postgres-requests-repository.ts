import { campaignTable } from "../../campaigns/active-campaign.js";
import type { RequestRecord } from "../../domain/request.js";
import type { PostgresExecutor } from "../../infra/postgres.js";
import type { RequestsRepository } from "../../engine/repositories/requests-repository.js";

type RequestRow = {
  delivery_method?: "manual" | "username" | null;
  delivery_username?: string | null;
  id: number | string;
  initiator_timezone?: string | null;
  recipient_name?: string | null;
  selected_variant_idx?: number | null;
  status?: string | null;
};

export class PostgresRequestsRepository implements RequestsRepository {
  constructor(private readonly db: PostgresExecutor) {}

  async closeCompletedRequest(requestId: string): Promise<void> {
    await this.db.query(
      `
        update ${campaignTable("requests")}
        set
          status = 'closed'::public.request_status,
          closed_at = coalesce(closed_at, now())
        where id = $1::bigint
          and status <> 'closed'::public.request_status;
      `,
      [requestId]
    );
  }

  async createOpenRequest(userId: number): Promise<RequestRecord> {
    const result = await this.db.query<RequestRow>(
      `
        insert into ${campaignTable("requests")} (
          user_id,
          status,
          created_at,
          updated_at
        )
        values ($1, 'open', now(), now())
        returning id, recipient_name;
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create request");
    }

    return {
      id: String(row.id),
      recipientName: row.recipient_name ?? null
    };
  }

  async closeOpenRequest(requestId: string): Promise<void> {
    await this.db.query(
      `
        update ${campaignTable("requests")}
        set status = 'cancelled',
            closed_at = now(),
            updated_at = now()
        where id = $1::bigint
          and status = 'open';
      `,
      [requestId]
    );
  }

  async findLatestOpenByTelegramUserId(tgUserId: string): Promise<RequestRecord | null> {
    const result = await this.db.query<RequestRow>(
      `
        select
          r.id,
          r.recipient_name,
          r.status,
          r.selected_variant_idx,
          r.delivery_method,
          r.delivery_username,
          r.initiator_timezone
        from ${campaignTable("requests")} r
        join ${campaignTable("users")} u on u.id = r.user_id
        where u.tg_user_id = $1::bigint
          and r.status = 'open'
        order by r.updated_at desc nulls last, r.created_at desc, r.id desc
        limit 1;
      `,
      [tgUserId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      deliveryMethod: row.delivery_method ?? null,
      deliveryUsername: row.delivery_username ?? null,
      id: String(row.id),
      initiatorTimezone: row.initiator_timezone ?? null,
      recipientName: row.recipient_name ?? null,
      selectedVariantIdx: row.selected_variant_idx ?? null,
      status: row.status ?? null
    };
  }

  async getById(requestId: string): Promise<RequestRecord | null> {
    const result = await this.db.query<RequestRow>(
      `
        select id, recipient_name, status, selected_variant_idx, delivery_method, delivery_username, initiator_timezone
        from ${campaignTable("requests")}
        where id = $1::bigint
        limit 1;
      `,
      [requestId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      deliveryMethod: row.delivery_method ?? null,
      deliveryUsername: row.delivery_username ?? null,
      id: String(row.id),
      initiatorTimezone: row.initiator_timezone ?? null,
      recipientName: row.recipient_name ?? null,
      selectedVariantIdx: row.selected_variant_idx ?? null,
      status: row.status ?? null
    };
  }

  async setDeliveryManual(requestId: string): Promise<void> {
    await this.db.query(
      `
        update ${campaignTable("requests")}
        set delivery_method = 'manual'::public.delivery_method,
            delivery_username = null,
            updated_at = now()
        where id = $1::bigint;
      `,
      [requestId]
    );
  }

  async setDeliveryUsername(requestId: string, username: string): Promise<void> {
    await this.db.query(
      `
        update ${campaignTable("requests")}
        set delivery_method = 'username'::public.delivery_method,
            delivery_username = $2,
            updated_at = now()
        where id = $1::bigint;
      `,
      [requestId, username]
    );
  }

  async setInitiatorTimezone(requestId: string, timezone: string): Promise<void> {
    await this.db.query(
      `
        UPDATE ${campaignTable("requests")}
        SET initiator_timezone = $2,
            initiator_timezone_source = 'manual',
            updated_at = now()
        WHERE id = $1::bigint;
      `,
      [requestId, timezone]
    );
  }

  async setSelectedVariant(requestId: string, selectedVariantIdx: number): Promise<void> {
    await this.db.query(
      `
        update ${campaignTable("requests")}
        set selected_variant_idx = $2,
            updated_at = now()
        where id = $1::bigint;
      `,
      [requestId, selectedVariantIdx]
    );
  }

  async updateRecipientName(requestId: string, recipientName: string): Promise<RequestRecord> {
    const result = await this.db.query<RequestRow>(
      `
        update ${campaignTable("requests")}
        set recipient_name = $2,
            updated_at = now()
        where id = $1::bigint
        returning id, recipient_name;
      `,
      [requestId, recipientName]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to update recipient name");
    }

    return {
      id: String(row.id),
      recipientName: row.recipient_name ?? null
    };
  }
}

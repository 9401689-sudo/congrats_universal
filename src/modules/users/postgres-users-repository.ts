import type { PostgresExecutor } from "../../infra/postgres.js";
import type { UserRecord } from "../../domain/user.js";
import type { UsersRepository } from "./users-repository.js";

type UpsertRow = { id: number };

export class PostgresUsersRepository implements UsersRepository {
  constructor(private readonly db: PostgresExecutor) {}

  async setTimezone(tgUserId: string, timezone: string): Promise<void> {
    await this.db.query(
      `
        update razreshenobot.users
        set timezone = $2,
            timezone_source = 'manual',
            timezone_updated_at = now(),
            last_seen_at = now()
        where tg_user_id = $1::bigint;
      `,
      [tgUserId, timezone]
    );
  }

  async upsertTelegramUser(input: {
    tgUserId: string;
    tgFirstName: string | null;
    tgLastName: string | null;
    tgUsername: string | null;
  }): Promise<UserRecord> {
    const result = await this.db.query<UpsertRow>(
      `
        insert into razreshenobot.users (tg_user_id, first_seen_at, last_seen_at)
        values ($1::bigint, now(), now())
        on conflict (tg_user_id)
        do update set last_seen_at = now()
        returning id;
      `,
      [input.tgUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert Telegram user");
    }

    return {
      id: Number(row.id),
      tgUserId: input.tgUserId
    };
  }
}

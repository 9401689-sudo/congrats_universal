import type { UserRecord } from "../../domain/user.js";
import type { UsersRepository } from "./users-repository.js";

export class InMemoryUsersRepository implements UsersRepository {
  private seq = 1;
  private readonly byTelegramUserId = new Map<string, UserRecord>();

  async setTimezone(_tgUserId: string, _timezone: string): Promise<void> {}

  async upsertTelegramUser(input: {
    tgUserId: string;
    tgFirstName: string | null;
    tgLastName: string | null;
    tgUsername: string | null;
  }): Promise<UserRecord> {
    const existing = this.byTelegramUserId.get(input.tgUserId);
    if (existing) {
      return existing;
    }

    const created: UserRecord = {
      id: this.seq++,
      tgUserId: input.tgUserId
    };
    this.byTelegramUserId.set(input.tgUserId, created);
    return created;
  }

  getByTelegramUserId(tgUserId: string): UserRecord | null {
    return this.byTelegramUserId.get(tgUserId) ?? null;
  }
}

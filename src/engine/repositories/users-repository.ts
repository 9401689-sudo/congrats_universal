import type { UserRecord } from "../../domain/user.js";

export interface UsersRepository {
  setTimezone(tgUserId: string, timezone: string): Promise<void>;
  upsertTelegramUser(input: {
    tgUserId: string;
    tgFirstName: string | null;
    tgLastName: string | null;
    tgUsername: string | null;
  }): Promise<UserRecord>;
}

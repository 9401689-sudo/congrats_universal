import type { BotSession } from "../../domain/session.js";

export interface SessionStore {
  get(tgUserId: string): Promise<BotSession | null>;
  set(session: BotSession): Promise<void>;
}

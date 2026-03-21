import type { BotSession } from "../../domain/session.js";
import type { SessionStore } from "../../engine/state/session-store.js";

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, BotSession>();

  async get(tgUserId: string): Promise<BotSession | null> {
    return this.sessions.get(tgUserId) ?? null;
  }

  async set(session: BotSession): Promise<void> {
    this.sessions.set(session.tgUserId, session);
  }

  async delete(tgUserId: string): Promise<void> {
    this.sessions.delete(tgUserId);
  }
}

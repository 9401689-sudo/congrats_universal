import type { RedisClient } from "../../infra/redis.js";
import {
  fromLegacySession,
  toLegacySession,
  type BotSession,
  type LegacyBotSession
} from "../../domain/session.js";
import type { SessionStore } from "../../engine/state/session-store.js";
import { buildCampaignRedisSessionKey } from "../../campaigns/current-campaign.js";

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisClient) {}

  async get(tgUserId: string): Promise<BotSession | null> {
    const raw = await this.redis.get(buildCampaignRedisSessionKey(tgUserId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as LegacyBotSession;
    return fromLegacySession(parsed, tgUserId);
  }

  async set(session: BotSession): Promise<void> {
    await this.redis.set(
      buildCampaignRedisSessionKey(session.tgUserId),
      JSON.stringify(toLegacySession(session)),
      "EX",
      86400
    );
  }
}

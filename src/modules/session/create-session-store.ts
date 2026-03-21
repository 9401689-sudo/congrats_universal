import type { RedisClient } from "../../infra/redis.js";
import type { SessionStore } from "../../engine/state/session-store.js";
import { InMemorySessionStore } from "./in-memory-session-store.js";
import { RedisSessionStore } from "./redis-session-store.js";

export function createSessionStore(redisClient?: RedisClient): SessionStore {
  if (!redisClient) {
    return new InMemorySessionStore();
  }

  return new RedisSessionStore(redisClient);
}

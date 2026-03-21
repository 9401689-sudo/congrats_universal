import type { RedisClient } from "../../infra/redis.js";
import { InMemoryVariantsRepository } from "./in-memory-variants-repository.js";
import { RedisVariantsRepository } from "./redis-variants-repository.js";
import type { VariantsRepository } from "./variants-repository.js";

export function createVariantsRepository(redisClient?: RedisClient): VariantsRepository {
  if (!redisClient) {
    return new InMemoryVariantsRepository();
  }

  return new RedisVariantsRepository(redisClient);
}

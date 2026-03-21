import { Redis } from "ioredis";

export type RedisClient = Redis;

export function createRedisClient(redisUrl: string): RedisClient {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 1
  });
}

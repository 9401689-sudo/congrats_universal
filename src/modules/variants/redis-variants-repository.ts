import type { RedisClient } from "../../infra/redis.js";
import type { VariantSnapshot } from "../../domain/variant.js";
import type { VariantsRepository } from "./variants-repository.js";

export class RedisVariantsRepository implements VariantsRepository {
  constructor(private readonly redis: RedisClient) {}

  async get(requestId: string, idx: number): Promise<VariantSnapshot | null> {
    const raw = await this.redis.get(`razresheno:req:${requestId}:v:${idx}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as VariantSnapshot;
  }

  async set(requestId: string, snapshot: VariantSnapshot): Promise<void> {
    await this.redis.set(
      `razresheno:req:${requestId}:v:${snapshot.idx}`,
      JSON.stringify(snapshot),
      "EX",
      86400
    );
  }
}

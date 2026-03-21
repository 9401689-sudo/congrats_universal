import type { VariantSnapshot } from "../../domain/variant.js";
import type { VariantsRepository } from "./variants-repository.js";

export class InMemoryVariantsRepository implements VariantsRepository {
  private readonly store = new Map<string, VariantSnapshot>();

  async get(requestId: string, idx: number): Promise<VariantSnapshot | null> {
    return this.store.get(`${requestId}:${idx}`) ?? null;
  }

  async set(requestId: string, snapshot: VariantSnapshot): Promise<void> {
    this.store.set(`${requestId}:${snapshot.idx}`, snapshot);
  }
}

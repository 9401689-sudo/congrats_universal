import type { VariantSnapshot } from "../../domain/variant.js";

export interface VariantsRepository {
  get(requestId: string, idx: number): Promise<VariantSnapshot | null>;
  set(requestId: string, snapshot: VariantSnapshot): Promise<void>;
}

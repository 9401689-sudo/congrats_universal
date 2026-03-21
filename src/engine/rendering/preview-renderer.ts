import type { VariantSnapshot } from "../../domain/variant.js";

export interface PreviewRenderer {
  renderPreview(input: {
    requestId: string;
    variant: VariantSnapshot;
  }): Promise<{ renderedPath: string }>;
}

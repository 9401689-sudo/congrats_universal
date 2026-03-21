import type { RenderingAdapter } from "../../engine/rendering/rendering-adapter.js";

export class FakeRenderingAdapter implements RenderingAdapter {
  async renderFinal(input: {
    deliveryId: string;
    renderParams: Record<string, unknown>;
    requestId: string;
  }): Promise<{ fileId: string; renderedPath: string }> {
    return {
      fileId: `rendered_${input.requestId}_${input.deliveryId}`,
      renderedPath: `/tmp/rendered_${input.requestId}_${input.deliveryId}.png`
    };
  }
}

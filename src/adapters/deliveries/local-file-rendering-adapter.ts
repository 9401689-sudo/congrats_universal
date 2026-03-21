import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RenderingAdapter } from "../../engine/rendering/rendering-adapter.js";

export class LocalFileRenderingAdapter implements RenderingAdapter {
  constructor(private readonly outputDir: string) {}

  async renderFinal(input: {
    deliveryId: string;
    renderParams: Record<string, unknown>;
    requestId: string;
  }): Promise<{ fileId: string; renderedPath: string }> {
    await mkdir(this.outputDir, { recursive: true });

    const renderedPath = path.join(
      this.outputDir,
      `req${input.requestId}_delivery_${input.deliveryId}.json`
    );

    const payload = {
      generated_at: new Date().toISOString(),
      mode: "final",
      request_id: input.requestId,
      delivery_id: input.deliveryId,
      render_params: input.renderParams
    };

    await writeFile(renderedPath, JSON.stringify(payload, null, 2), "utf8");

    return {
      fileId: `local_${input.requestId}_${input.deliveryId}`,
      renderedPath
    };
  }
}

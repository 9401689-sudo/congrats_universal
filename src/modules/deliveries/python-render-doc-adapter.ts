import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { PythonRendererWorkerClient } from "../../engine/rendering/python-renderer-worker-client.js";
import type { RenderingAdapter } from "../../engine/rendering/rendering-adapter.js";

type PythonRenderDocAdapterOptions = {
  outputDir: string;
  templatesDir?: string;
  workerClient: PythonRendererWorkerClient;
};

export class PythonRenderDocAdapter implements RenderingAdapter {
  constructor(private readonly options: PythonRenderDocAdapterOptions) {}

  async renderFinal(input: {
    deliveryId: string;
    renderParams: Record<string, unknown>;
    requestId: string;
  }): Promise<{ fileId: string; renderedPath: string }> {
    await mkdir(this.options.outputDir, { recursive: true });

    const renderedPath = path.join(
      this.options.outputDir,
      `req${input.requestId}_delivery_${input.deliveryId}.png`
    );

    const payload = {
      mode: "final",
      output_path: renderedPath,
      templates_dir: this.options.templatesDir,
      ...input.renderParams
    };

    await this.options.workerClient.render(payload);
    const statProbe = await readFile(renderedPath);

    if (!statProbe.length) {
      throw new Error(`Python renderer produced an empty file: ${renderedPath}`);
    }

    return {
      fileId: `rendered_${input.requestId}_${input.deliveryId}`,
      renderedPath
    };
  }
}

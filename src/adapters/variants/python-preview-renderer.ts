import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { buildCampaignRenderPayload } from "../../campaigns/active-campaign.js";
import type { PreviewRenderer } from "../../engine/rendering/preview-renderer.js";
import type { PythonRendererWorkerClient } from "../../engine/rendering/python-renderer-worker-client.js";
import type { VariantSnapshot } from "../../domain/variant.js";

type PythonPreviewRendererOptions = {
  outputDir: string;
  templatesDir?: string;
  workerClient: PythonRendererWorkerClient;
};

export class PythonPreviewRenderer implements PreviewRenderer {
  constructor(private readonly options: PythonPreviewRendererOptions) {}

  async renderPreview(input: {
    requestId: string;
    variant: VariantSnapshot;
  }): Promise<{ renderedPath: string }> {
    const previewsDir = path.join(this.options.outputDir, "previews");
    await mkdir(previewsDir, { recursive: true });

    const renderedPath = path.join(previewsDir, `req${input.requestId}_v${input.variant.idx}.png`);

    const payload = {
      ...buildCampaignRenderPayload({
        intro: input.variant.content.intro,
        outputPath: renderedPath,
        points: input.variant.content.points,
        recipientName: input.variant.recipientName,
        requestId: input.requestId,
        templatesDir: this.options.templatesDir
      }),
      mode: "preview",
      initiator_name: input.variant.initiatorName,
      bg: input.variant.bg,
      layout: input.variant.layout,
    };

    await this.options.workerClient.render(payload);

    const contents = await readFile(renderedPath);
    if (!contents.length) {
      throw new Error(`Preview renderer produced an empty file: ${renderedPath}`);
    }

    return { renderedPath };
  }
}

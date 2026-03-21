import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCampaignDocumentNumber,
  currentCampaign
} from "../../campaigns/current-campaign.js";
import type { VariantSnapshot } from "../../domain/variant.js";
import type { PythonRendererWorkerClient } from "../rendering/python-renderer-worker-client.js";
import type { PreviewRenderer } from "./preview-renderer.js";

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
      mode: "preview",
      recipient_name: input.variant.recipientName,
      initiator_name: input.variant.initiatorName,
      doc_no: buildCampaignDocumentNumber(input.requestId),
      templates_dir: this.options.templatesDir ?? currentCampaign.renderer.templatesDir,
      bg: input.variant.bg,
      intro: input.variant.content.intro,
      points: input.variant.content.points,
      layout: input.variant.layout,
      qr_url: currentCampaign.telegram.qrUrl,
      output_path: renderedPath
    };

    await this.options.workerClient.render(payload);

    const contents = await readFile(renderedPath);
    if (!contents.length) {
      throw new Error(`Preview renderer produced an empty file: ${renderedPath}`);
    }

    return { renderedPath };
  }
}

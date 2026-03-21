import {
  buildCampaignDocumentNumber,
  buildCampaignDocumentSubtitle,
  currentCampaign
} from "./current-campaign.js";

export function buildCampaignRenderPayload(input: {
  docNo?: string;
  intro?: string;
  outputPath?: string;
  points?: string[];
  recipientName?: string;
  requestId: string;
  templatesDir?: string;
}): Record<string, unknown> {
  const docNo = input.docNo ?? buildCampaignDocumentNumber(input.requestId);

  return {
    doc_no: docNo,
    footer_lines: ["Вступает в силу немедленно.", "Обжалованию не подлежит."],
    header_small: currentCampaign.document.headerSmall,
    intro: input.intro,
    output_path: input.outputPath,
    points: input.points,
    qr_url: currentCampaign.telegram.qrUrl,
    recipient_name: input.recipientName,
    source_line: currentCampaign.document.sourceLine,
    subtitle: buildCampaignDocumentSubtitle(input.requestId),
    templates_dir: input.templatesDir ?? currentCampaign.renderer.templatesDir,
    title: currentCampaign.document.title,
    watermark_lines: ["Предварительная версия.", "Не заверено."]
  };
}

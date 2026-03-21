import {
  buildCampaignDocumentNumber,
  currentCampaign
} from "../../campaigns/active-campaign.js";
import { buildCampaignRenderPayload } from "../../campaigns/active-campaign.js";
import {
  computeCampaignScheduledAt,
  currentCampaignRules,
  isCampaignTariff
} from "../../campaigns/active-campaign.js";
import type { PaymentsRepository } from "./payments-repository.js";
import type { DeliveriesRepository } from "../repositories/deliveries-repository.js";
import type { DocumentsRepository } from "../repositories/documents-repository.js";
import type { RequestsRepository } from "../repositories/requests-repository.js";
import type { SessionStore } from "../state/session-store.js";

type YookassaWebhookBody = {
  event?: string;
  object?: {
    id?: string;
    metadata?: {
      request_id?: string;
      tariff?: string;
      tg_user_id?: string;
    };
  };
};

export class YookassaWebhookService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly requestsRepository: RequestsRepository,
    private readonly documentsRepository: DocumentsRepository,
    private readonly deliveriesRepository: DeliveriesRepository,
    private readonly sessionStore: SessionStore
  ) {}

  async handleWebhook(body: YookassaWebhookBody): Promise<{ ok: true }> {
    const event = String(body.event ?? "");
    const providerPaymentId = String(body.object?.id ?? "");

    if (!providerPaymentId) {
      return { ok: true };
    }

    if (event === "payment.canceled") {
      await this.paymentsRepository.markCanceled(providerPaymentId);
      return { ok: true };
    }

    if (event !== "payment.succeeded") {
      return { ok: true };
    }

    const requestId = String(body.object?.metadata?.request_id ?? "");
    const tgUserId = String(body.object?.metadata?.tg_user_id ?? "");
    const tariff = isCampaignTariff(body.object?.metadata?.tariff) ? body.object?.metadata?.tariff : "199";

    if (!requestId || !tgUserId) {
      return { ok: true };
    }

    await this.paymentsRepository.upsertPaid({
      providerPaymentId,
      requestId,
      tariff,
      tgUserId
    });

    const request = await this.requestsRepository.getById(requestId);
    if (!request) {
      return { ok: true };
    }

    const document = await this.documentsRepository.upsertDocument({
      initiatorName: "Инициатор",
      renderParams: {
        ...buildCampaignRenderPayload({
          requestId,
          recipientName: request.recipientName ?? "",
          templatesDir: currentCampaign.renderer.templatesDir
        }),
        delivery_method: request.deliveryMethod ?? "manual",
        delivery_username: request.deliveryUsername ?? null,
        initiator_name: "Инициатор",
        request_id: requestId,
        selected_variant_idx: request.selectedVariantIdx ?? null,
        doc_no: buildCampaignDocumentNumber(requestId)
      },
      requestId,
      tariff
    });

    if (tariff === "149") {
      await this.documentsRepository.setFinalFileId(document.id, `generated_${document.id}`);
      await this.requestsRepository.closeOpenRequest(requestId);
      await this.sessionStore.delete(tgUserId);
      return { ok: true };
    }

    await this.deliveriesRepository.createScheduledDelivery({
      deliveryMethod: request.deliveryMethod ?? "manual",
      documentId: document.id,
      recipientUsername: request.deliveryUsername ?? null,
      scheduledAt: computeCampaignScheduledAt(
        request.initiatorTimezone ?? currentCampaignRules.defaultDeliveryTimezone
      )
    });
    await this.requestsRepository.closeOpenRequest(requestId);
    await this.sessionStore.delete(tgUserId);
    return { ok: true };
  }
}

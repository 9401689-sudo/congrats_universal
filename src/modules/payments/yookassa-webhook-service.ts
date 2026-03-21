import type { DocumentsRepository } from "../documents/documents-repository.js";
import type { DeliveriesRepository } from "../deliveries/deliveries-repository.js";
import type { PaymentsRepository } from "./payments-repository.js";
import type { RequestsRepository } from "../requests/requests-repository.js";

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
    private readonly deliveriesRepository: DeliveriesRepository
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
    const tariff = body.object?.metadata?.tariff === "149" ? "149" : "199";

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
        doc_no: `0803-${requestId.padStart(3, "0")}`,
        delivery_method: request.deliveryMethod ?? "manual",
        delivery_username: request.deliveryUsername ?? null,
        initiator_name: "Инициатор",
        recipient_name: request.recipientName ?? "",
        request_id: requestId,
        selected_variant_idx: request.selectedVariantIdx ?? null,
        templates_dir: "/mnt/razresheno/templates",
        title: "РАЗРЕШЕНО",
        subtitle: `ОФИЦИАЛЬНЫЙ ДОКУМЕНТ № 0803-${requestId.padStart(3, "0")}`,
        qr_url: "https://t.me/razresheno_buro_bot"
      },
      requestId,
      tariff
    });

    if (tariff === "149") {
      await this.documentsRepository.setFinalFileId(document.id, `generated_${document.id}`);
      await this.requestsRepository.closeOpenRequest(requestId);
      return { ok: true };
    }

    await this.deliveriesRepository.createScheduledDelivery({
      deliveryMethod: request.deliveryMethod ?? "manual",
      documentId: document.id,
      recipientUsername: request.deliveryUsername ?? null,
      scheduledAt: computeScheduledAt(request.initiatorTimezone ?? "Europe/Moscow")
    });
    await this.requestsRepository.closeOpenRequest(requestId);
    return { ok: true };
  }
}

function computeScheduledAt(timezone: string): string {
  const offsets: Record<string, number> = {
    "Asia/Irkutsk": 8,
    "Asia/Krasnoyarsk": 7,
    "Asia/Omsk": 6,
    "Asia/Vladivostok": 10,
    "Asia/Yakutsk": 9,
    "Asia/Yekaterinburg": 5,
    "Europe/Moscow": 3
  };

  const offset = offsets[timezone] ?? 3;
  const now = new Date();
  const targetYear =
    now.getUTCMonth() > 2 || (now.getUTCMonth() === 2 && now.getUTCDate() > 8)
      ? now.getUTCFullYear() + 1
      : now.getUTCFullYear();

  return new Date(Date.UTC(targetYear, 2, 8, 9 - offset, 0, 0)).toISOString();
}

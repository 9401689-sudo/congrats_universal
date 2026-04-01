import type { RenderingAdapter } from "../rendering/rendering-adapter.js";
import type { DeliveryTransport } from "./delivery-transport.js";
import type { DeliveriesRepository } from "../repositories/deliveries-repository.js";
import type { DocumentsRepository } from "../repositories/documents-repository.js";
import type { RequestsRepository } from "../repositories/requests-repository.js";

export class DeliveryWorkerService {
  constructor(
    private readonly deliveriesRepository: DeliveriesRepository,
    private readonly documentsRepository: DocumentsRepository,
    private readonly requestsRepository: RequestsRepository,
    private readonly renderingAdapter: RenderingAdapter,
    private readonly deliveryTransport: DeliveryTransport
  ) {}

  async runOnce(): Promise<{ locked: number; sent: number }> {
    const ids = await this.deliveriesRepository.listDueDeliveryIds(20);
    let locked = 0;
    let sent = 0;

    for (const id of ids) {
      const ok = await this.deliveriesRepository.tryLock(id, "code_delivery_worker");
      if (!ok) {
        continue;
      }

      locked += 1;
      const context = await this.deliveriesRepository.getContext(id);
      if (!context) {
        continue;
      }

      let fileId = context.finalFileId;

      if (!fileId) {
        const rendered = await this.renderingAdapter.renderFinal({
          deliveryId: context.deliveryId,
          renderParams: context.renderParams,
          requestId: context.requestId
        });
        fileId = rendered.fileId;
        await this.documentsRepository.setFinalFileId(context.documentId, fileId);
      }

      await this.deliveryTransport.sendDocument({
        caption: "Документ готов и направлен по расписанию.",
        chatId: context.tgUserId,
        deliveryMethod: context.deliveryMethod,
        fileId,
        recipientUsername: context.recipientUsername
      });

      await this.deliveriesRepository.markSent(context.deliveryId);
      await this.requestsRepository.closeCompletedRequest(context.requestId);
      sent += 1;
    }

    return { locked, sent };
  }
}

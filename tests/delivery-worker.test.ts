import test from "node:test";
import assert from "node:assert/strict";

import { DeliveryWorkerService } from "../src/engine/delivery/delivery-worker-service.js";
import type { DeliveryTransport } from "../src/engine/delivery/delivery-transport.js";
import type { RenderingAdapter } from "../src/engine/rendering/rendering-adapter.js";
import type { DeliveriesRepository } from "../src/modules/deliveries/deliveries-repository.js";
import { InMemoryDocumentsRepository } from "../src/modules/documents/in-memory-documents-repository.js";
import { InMemoryRequestsRepository } from "../src/modules/requests/in-memory-requests-repository.js";

test("delivery worker renders, sends and marks delivery as sent", async () => {
  const documentsRepository = new InMemoryDocumentsRepository();
  const requestsRepository = new InMemoryRequestsRepository();
  const request = await requestsRepository.createOpenRequest(1);
  const document = await documentsRepository.upsertDocument({
    initiatorName: "Ivan",
    renderParams: { foo: "bar" },
    requestId: request.id,
    tariff: "199"
  });

  let sent = false;
  let savedFileId: string | null = null;

  const deliveriesRepository: DeliveriesRepository = {
    async createScheduledDelivery() {
      throw new Error("not used");
    },
    async getContext(deliveryId) {
      return {
        deliveryId,
        deliveryMethod: "manual",
        documentId: document.id,
        finalFileId: null,
        renderParams: { foo: "bar" },
        requestId: request.id,
        tgUserId: "101"
      };
    },
    async listDueDeliveryIds() {
      return ["delivery-1"];
    },
    async markSent(deliveryId) {
      assert.equal(deliveryId, "delivery-1");
      sent = true;
    },
    async tryLock() {
      return true;
    }
  };

  const renderingAdapter: RenderingAdapter = {
    async renderFinal() {
      return {
        fileId: "file_123",
        renderedPath: "/tmp/file.png"
      };
    }
  };

  const deliveryTransport: DeliveryTransport = {
    async sendDocument(input) {
      assert.equal(input.chatId, "101");
      assert.equal(input.fileId, "file_123");
      return { fileId: "file_123" };
    }
  };

  const originalSetFinalFileId = documentsRepository.setFinalFileId.bind(documentsRepository);
  documentsRepository.setFinalFileId = async (documentId, finalFileId) => {
    savedFileId = finalFileId;
    await originalSetFinalFileId(documentId, finalFileId);
  };

  const worker = new DeliveryWorkerService(
    deliveriesRepository,
    documentsRepository,
    requestsRepository,
    renderingAdapter,
    deliveryTransport
  );

  const result = await worker.runOnce();

  assert.equal(result.locked, 1);
  assert.equal(result.sent, 1);
  assert.equal(savedFileId, "file_123");
  assert.equal(sent, true);
});

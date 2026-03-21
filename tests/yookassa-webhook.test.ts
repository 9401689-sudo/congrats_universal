import test from "node:test";
import assert from "node:assert/strict";

import { YookassaWebhookService } from "../src/engine/payments/yookassa-webhook-service.js";
import { InMemoryDocumentsRepository } from "../src/adapters/documents/in-memory-documents-repository.js";
import { InMemoryDeliveriesRepository } from "../src/adapters/deliveries/in-memory-deliveries-repository.js";
import { InMemoryPaymentsRepository } from "../src/adapters/payments/in-memory-payments-repository.js";
import { InMemoryRequestsRepository } from "../src/adapters/requests/in-memory-requests-repository.js";

test("payment.succeeded for tariff 199 creates scheduled delivery", async () => {
  const paymentsRepository = new InMemoryPaymentsRepository();
  const requestsRepository = new InMemoryRequestsRepository();
  const documentsRepository = new InMemoryDocumentsRepository();
  const deliveriesRepository = new InMemoryDeliveriesRepository();

  const request = await requestsRepository.createOpenRequest(1);
  await requestsRepository.setSelectedVariant(request.id, 1);
  await requestsRepository.setInitiatorTimezone(request.id, "Europe/Moscow");
  await requestsRepository.setDeliveryManual(request.id);

  const service = new YookassaWebhookService(
    paymentsRepository,
    requestsRepository,
    documentsRepository,
    deliveriesRepository
  );

  await service.handleWebhook({
    event: "payment.succeeded",
    object: {
      id: "yk_1",
      metadata: {
        request_id: request.id,
        tariff: "199",
        tg_user_id: "101"
      }
    }
  });

  const deliveryIds = await deliveriesRepository.listDueDeliveryIds(10);
  assert.equal(deliveryIds.length, 1);
});

test("payment.succeeded for tariff 149 finalizes document without delivery", async () => {
  const paymentsRepository = new InMemoryPaymentsRepository();
  const requestsRepository = new InMemoryRequestsRepository();
  const documentsRepository = new InMemoryDocumentsRepository();
  const deliveriesRepository = new InMemoryDeliveriesRepository();

  const request = await requestsRepository.createOpenRequest(1);
  await requestsRepository.setSelectedVariant(request.id, 1);

  const service = new YookassaWebhookService(
    paymentsRepository,
    requestsRepository,
    documentsRepository,
    deliveriesRepository
  );

  await service.handleWebhook({
    event: "payment.succeeded",
    object: {
      id: "yk_149",
      metadata: {
        request_id: request.id,
        tariff: "149",
        tg_user_id: "101"
      }
    }
  });

  const payment = await paymentsRepository.findByProviderPaymentId("yk_149");
  assert.equal(payment?.tariff, "149");
  assert.equal((await deliveriesRepository.listDueDeliveryIds(10)).length, 0);
});

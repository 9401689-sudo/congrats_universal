import test from "node:test";
import assert from "node:assert/strict";

import { TelegramApplicationService } from "../src/engine/app/telegram-application-service.js";
import { normalizeTelegramUpdate } from "../src/engine/telegram/normalize-telegram-update.js";
import { InMemoryUsersRepository } from "../src/adapters/users/in-memory-users-repository.js";
import { InMemoryRequestsRepository } from "../src/adapters/requests/in-memory-requests-repository.js";
import { InMemorySessionStore } from "../src/adapters/session/in-memory-session-store.js";
import { InMemoryVariantsRepository } from "../src/adapters/variants/in-memory-variants-repository.js";
import { FakePaymentService } from "../src/adapters/payments/fake-payment-service.js";
import { InMemoryPaymentsRepository } from "../src/adapters/payments/in-memory-payments-repository.js";
import { CapturingTelegramGateway } from "./helpers/capturing-telegram-gateway.js";

function createService() {
  const telegramGateway = new CapturingTelegramGateway();
  return {
    requestsRepository: new InMemoryRequestsRepository(),
    service: new TelegramApplicationService(
      new InMemoryUsersRepository(),
      new InMemoryRequestsRepository(),
      new InMemorySessionStore(),
      telegramGateway,
      new InMemoryVariantsRepository(),
      new FakePaymentService(),
      new InMemoryPaymentsRepository()
    ),
    telegramGateway
  };
}

test("start -> start_new -> recipient_name -> gen_first updates session and sends buttons", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 1,
        text: "/start"
      },
      update_id: 1
    })
  );

  assert.equal(telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data, "START_NEW");

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );

  const sessionAfterStart = await sessionStore.get("101");
  assert.ok(sessionAfterStart?.activeRequestId);
  assert.equal(sessionAfterStart?.awaiting, "recipient_name");
  assert.match(telegramGateway.messages.at(-1)?.text ?? "", /Укажите имя получателя/);

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );

  const session = await sessionStore.get("101");
  assert.equal(session?.recipientName, "Мария");
  assert.equal(session?.lastVariantIdx, 1);
  assert.equal(telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data, "GEN_NEXT");
  assert.equal(telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[1]?.[0]?.callback_data, "GO_SEAL");
});

test("start_continue resumes draft and triggers generation when variants are not created yet", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );

  const sessionBeforeContinue = await sessionStore.get("101");
  assert.equal(sessionBeforeContinue?.lastVariantIdx, 1);

  await sessionStore.set({
    ...sessionBeforeContinue!,
    currentVariantIdx: 0,
    lastVariantIdx: 0
  });

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_CONTINUE",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );

  const sessionAfterContinue = await sessionStore.get("101");
  assert.equal(sessionAfterContinue?.recipientName, "Мария");
  assert.equal(sessionAfterContinue?.lastVariantIdx, 1);
  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "SEAL_PICK:1"
  );
});

test("first timezone selection for pay 199 continues to delivery choice", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ:Europe/Moscow",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 7 }
      },
      update_id: 7
    })
  );

  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "DELIV_USERNAME"
  );
});

test("go_seal with partial generation shows generated variants and gen_next", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GEN_NEXT",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GO_SEAL",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );

  const lastMessage = telegramGateway.messages.at(-1);
  assert.equal(lastMessage?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data, "SEAL_PICK:1");
  assert.equal(lastMessage?.replyMarkup?.inline_keyboard[1]?.[0]?.callback_data, "SEAL_PICK:2");
  assert.equal(lastMessage?.replyMarkup?.inline_keyboard[2]?.[0]?.callback_data, "GEN_NEXT");
});

test("seal pick -> pay 199 requests timezone first", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const variantsRepository = new InMemoryVariantsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    variantsRepository,
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GEN_FIRST",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );

  const requestId = (await sessionStore.get("101"))?.activeRequestId;
  assert.ok(requestId);
  const request = await requestsRepository.getById(requestId!);
  assert.equal(request?.selectedVariantIdx, 1);
  assert.equal(telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data, "PAY:149");

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );

  const session = await sessionStore.get("101");
  assert.equal(session?.awaiting, "tz");
  assert.match(telegramGateway.messages.at(-1)?.text ?? "", /Выберите ваш часовой пояс/);
});

test("pay 149 asks for email and then returns payment url button", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GEN_FIRST",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:149",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );

  assert.match(telegramGateway.messages.at(-1)?.text ?? "", /Укажите email/);

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 7,
        text: "name@example.com"
      },
      update_id: 7
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:149",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 8 }
      },
      update_id: 8
    })
  );

  const lastMessage = telegramGateway.messages.at(-1);
  assert.equal(lastMessage?.replyMarkup?.inline_keyboard[0]?.[0]?.text, "💳 Оплатить");
  assert.match(lastMessage?.replyMarkup?.inline_keyboard[0]?.[0]?.url ?? "", /example\.test\/pay/);
});

test("email confirmation sends a single continue message with button", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:149",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );

  const beforeEmailMessages = telegramGateway.messages.length;

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 6,
        text: "name@example.com"
      },
      update_id: 6
    })
  );

  assert.equal(telegramGateway.messages.length, beforeEmailMessages + 1);
  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "PAY:149"
  );
});

test("new request asks email again even if previous request already had one", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:149",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 7,
        text: "name@example.com"
      },
      update_id: 7
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_FORCE_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 8 }
      },
      update_id: 8
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 9,
        text: "Анна"
      },
      update_id: 9
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb6",
        message: { chat: { id: 101, type: "private" }, message_id: 10 }
      },
      update_id: 10
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:149",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb7",
        message: { chat: { id: 101, type: "private" }, message_id: 11 }
      },
      update_id: 11
    })
  );

  assert.match(telegramGateway.messages.at(-1)?.text ?? "", /Укажите email/);
});

test("pay 199 requests email after timezone and delivery method for current request", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ:Europe/Moscow",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "DELIV_MANUAL",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 7 }
      },
      update_id: 7
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb6",
        message: { chat: { id: 101, type: "private" }, message_id: 8 }
      },
      update_id: 8
    })
  );

  assert.match(telegramGateway.messages.at(-1)?.text ?? "", /Укажите email/);
});

test("tz_change -> tz_set returns user to tariff screen", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GEN_FIRST",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ_CHANGE",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );

  let session = await sessionStore.get("101");
  assert.equal(session?.awaiting, "tz");

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ:Europe/Moscow",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 7 }
      },
      update_id: 7
    })
  );

  session = await sessionStore.get("101");
  assert.equal(session?.initiatorTimezone, "Europe/Moscow");
  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "PAY:149"
  );
});

test("pay 199 -> delivery manual stores manual mode and returns pay button", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GEN_FIRST",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ:Europe/Moscow",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 7 }
      },
      update_id: 7
    })
  );

  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "DELIV_USERNAME"
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "DELIV_MANUAL",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb6",
        message: { chat: { id: 101, type: "private" }, message_id: 8 }
      },
      update_id: 8
    })
  );

  const requestId = (await sessionStore.get("101"))?.activeRequestId;
  const request = await requestsRepository.getById(requestId!);
  assert.equal(request?.deliveryMethod, "manual");
  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "PAY:199"
  );
});

test("pay 199 -> delivery username validates and stores username", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "GEN_FIRST",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ:Europe/Moscow",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 7 }
      },
      update_id: 7
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "DELIV_USERNAME",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb6",
        message: { chat: { id: 101, type: "private" }, message_id: 8 }
      },
      update_id: 8
    })
  );

  let session = await sessionStore.get("101");
  assert.equal(session?.awaiting, "delivery_username");

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 9,
        text: "ivan_ivanov"
      },
      update_id: 9
    })
  );

  session = await sessionStore.get("101");
  const requestId = session?.activeRequestId;
  const request = await requestsRepository.getById(requestId!);
  assert.equal(session?.awaiting, "none");
  assert.equal(request?.deliveryMethod, "username");
  assert.equal(request?.deliveryUsername, "@ivan_ivanov");
});

test("delivery username confirmation sends a single continue message with button", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const requestsRepository = new InMemoryRequestsRepository();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    requestsRepository,
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "START_NEW",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb1",
        message: { chat: { id: 101, type: "private" }, message_id: 2 }
      },
      update_id: 2
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 3,
        text: "Мария"
      },
      update_id: 3
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "SEAL_PICK:1",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb2",
        message: { chat: { id: 101, type: "private" }, message_id: 4 }
      },
      update_id: 4
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "PAY:199",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb3",
        message: { chat: { id: 101, type: "private" }, message_id: 5 }
      },
      update_id: 5
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "TZ:Europe/Moscow",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb4",
        message: { chat: { id: 101, type: "private" }, message_id: 6 }
      },
      update_id: 6
    })
  );
  await service.processEvent(
    normalizeTelegramUpdate({
      callback_query: {
        data: "DELIV_USERNAME",
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        id: "cb5",
        message: { chat: { id: 101, type: "private" }, message_id: 7 }
      },
      update_id: 7
    })
  );

  const beforeUsernameMessages = telegramGateway.messages.length;

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 8,
        text: "ivan_ivanov"
      },
      update_id: 8
    })
  );

  assert.equal(telegramGateway.messages.length, beforeUsernameMessages + 1);
  assert.equal(
    telegramGateway.messages.at(-1)?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data,
    "PAY:199"
  );
});

test("unexpected text outside input states tells user to use buttons", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    new InMemoryRequestsRepository(),
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 1,
        text: "что дальше?"
      },
      update_id: 1
    })
  );

  assert.equal(telegramGateway.messages.at(-1)?.text, "Сейчас управление осуществляется кнопками.");
});

test("start performs best-effort chat cleanup", async () => {
  const sessionStore = new InMemorySessionStore();
  const telegramGateway = new CapturingTelegramGateway();
  const service = new TelegramApplicationService(
    new InMemoryUsersRepository(),
    new InMemoryRequestsRepository(),
    sessionStore,
    telegramGateway,
    new InMemoryVariantsRepository(),
    new FakePaymentService(),
    new InMemoryPaymentsRepository()
  );

  await service.processEvent(
    normalizeTelegramUpdate({
      message: {
        chat: { id: 101, type: "private" },
        from: { first_name: "Ivan", id: 101, username: "ivan" },
        message_id: 50,
        text: "/start"
      },
      update_id: 1
    })
  );

  assert.ok(telegramGateway.deletedMessageIds.includes("101:50"));
  assert.ok(telegramGateway.deletedMessageIds.includes("101:1"));
});

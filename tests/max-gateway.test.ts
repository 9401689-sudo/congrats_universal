import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MaxDeliveryTransport } from "../src/adapters/deliveries/max-delivery-transport.js";
import { MaxApiChannelGateway } from "../src/adapters/max/max-api-channel-gateway.js";

test("MAX clearInlineKeyboard edits message and removes attachments", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ init, url });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const gateway = new MaxApiChannelGateway("max-token");
    await gateway.clearInlineKeyboard({
      chatId: "123",
      messageId: "456"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://platform-api.max.ru/messages?message_id=456");
  assert.equal(calls[0]?.init?.method, "PUT");
  assert.equal(calls[0]?.init?.headers && (calls[0].init.headers as Record<string, string>).Authorization, "max-token");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ attachments: [] }));
});

test("MAX sendMessage clears previous inline keyboard before sending a new one", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ init, url });

    if (init?.method === "PUT") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (init?.method === "POST") {
      const postCount = calls.filter((call) => call.init?.method === "POST").length;
      return new Response(
        JSON.stringify({ message: { message_id: postCount === 1 ? "m1" : "m2" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  }) as typeof fetch;

  try {
    const gateway = new MaxApiChannelGateway("max-token");
    await gateway.sendMessage({
      chatId: "777",
      replyMarkup: {
        inline_keyboard: [[{ text: "One", callback_data: "ONE" }]]
      },
      text: "first"
    });

    await gateway.sendMessage({
      chatId: "777",
      replyMarkup: {
        inline_keyboard: [[{ text: "Two", callback_data: "TWO" }]]
      },
      text: "second"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[1]?.init?.method, "PUT");
  assert.equal(calls[1]?.url, "https://platform-api.max.ru/messages?message_id=m1");
  assert.equal(calls[2]?.init?.method, "POST");
});

test("MAX delivery transport uploads rendered file and sends file attachment", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "max-delivery-"));
  const renderedPath = path.join(tempDir, "document.png");
  await writeFile(renderedPath, "rendered");

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ init, url });

    if (url === "https://platform-api.max.ru/uploads?type=file") {
      return new Response(JSON.stringify({ url: "https://uploads.max.test/upload" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url === "https://uploads.max.test/upload") {
      return new Response(JSON.stringify({ token: "uploaded-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url === "https://platform-api.max.ru/messages?user_id=777") {
      return new Response(JSON.stringify({ message: { message_id: "m1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const transport = new MaxDeliveryTransport("max-token");
    const result = await transport.sendDocument({
      caption: "ready",
      chatId: "777",
      renderedPath
    });

    assert.equal(result.fileId, "uploaded-token");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.url, "https://platform-api.max.ru/uploads?type=file");
  assert.equal(calls[1]?.url, "https://uploads.max.test/upload");
  assert.equal(calls[2]?.url, "https://platform-api.max.ru/messages?user_id=777");
  assert.equal(calls[2]?.init?.method, "POST");

  const body = JSON.parse(String(calls[2]?.init?.body)) as {
    attachments: Array<{ payload: { token?: string }; type: string }>;
    text: string;
  };
  assert.equal(body.text, "ready");
  assert.equal(body.attachments[0]?.type, "file");
  assert.equal(body.attachments[0]?.payload?.token, "uploaded-token");
});

test("MAX delivery transport adds open-chat button for username delivery", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ init, url });

    if (url === "https://platform-api.max.ru/messages?user_id=777") {
      return new Response(JSON.stringify({ message: { message_id: "m2" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const transport = new MaxDeliveryTransport("max-token");
    await transport.sendDocument({
      caption: "ready",
      chatId: "777",
      deliveryMethod: "username",
      fileId: "existing-file",
      recipientUsername: "@recipient_name"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const body = JSON.parse(String(calls[0]?.init?.body)) as {
    attachments: Array<{ payload: unknown; type: string }>;
  };
  const keyboard = body.attachments[1] as {
    payload: {
      buttons: Array<Array<{ type: string; text: string; url?: string }>>;
    };
    type: string;
  };

  assert.equal(keyboard.type, "inline_keyboard");
  assert.equal(keyboard.payload.buttons[0]?.[0]?.type, "link");
  assert.equal(keyboard.payload.buttons[0]?.[0]?.url, "https://max.ru/recipient_name");
});

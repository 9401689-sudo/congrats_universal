import test from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

test("loadConfig parses multiple bot runtimes from BOT_RUNTIMES_JSON", () => {
  const config = loadConfig({
    BOT_RUNTIMES_JSON: JSON.stringify([
      {
        channel: "telegram",
        id: "march8",
        campaignId: "march8-razresheno",
        telegramBotToken: "111:aaa"
      },
      {
        channel: "telegram",
        id: "birthday",
        campaignId: "march8-razresheno",
        telegramBotToken: "222:bbb"
      }
    ]),
    DEFAULT_BOT_ID: "march8",
    HOST: "127.0.0.1",
    NODE_ENV: "test",
    PORT: "3001",
    RENDER_OUTPUT_DIR: ".local-renders"
  });

  assert.equal(config.defaultBotId, "march8");
  assert.deepEqual(Object.keys(config.botRuntimes).sort(), ["birthday", "march8"]);
  assert.equal(config.botRuntimes.birthday?.channel, "telegram");
  assert.equal(config.botRuntimes.birthday?.telegramBotToken, "222:bbb");
});

test("internal state exposes all configured bot runtimes", async (t) => {
  const app = buildApp(
    loadConfig({
      BOT_RUNTIMES_JSON: JSON.stringify([
        {
          channel: "telegram",
          id: "march8",
          campaignId: "march8-razresheno"
        },
        {
          channel: "telegram",
          id: "birthday",
          campaignId: "march8-razresheno"
        }
      ]),
      DEFAULT_BOT_ID: "march8",
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      PORT: "3001",
      RENDER_OUTPUT_DIR: ".local-renders"
    })
  );

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/internal/state"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(Object.keys(body.runtimes).sort(), ["birthday", "march8"]);
  assert.equal(body.runtimes.birthday.botRuntime.id, "birthday");
});

test("telegram webhook route can target a specific bot runtime", async (t) => {
  const app = buildApp(
    loadConfig({
      BOT_RUNTIMES_JSON: JSON.stringify([
        {
          channel: "telegram",
          id: "march8",
          campaignId: "march8-razresheno"
        },
        {
          channel: "telegram",
          id: "birthday",
          campaignId: "march8-razresheno"
        }
      ]),
      DEFAULT_BOT_ID: "march8",
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      PORT: "3001",
      RENDER_OUTPUT_DIR: ".local-renders"
    })
  );

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/telegram/birthday",
    payload: {
      message: {
        chat: { id: 501, type: "private" },
        from: { first_name: "Ivan", id: 501, username: "ivan" },
        message_id: 1,
        text: "/start"
      },
      update_id: 1
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });

  const birthdayContext = app.appContexts.birthday;
  const session = await birthdayContext.sessionStore.get("501");
  assert.equal(session?.tgUserId, "501");
});

test("max webhook route can target a MAX runtime", async (t) => {
  const app = buildApp(
    loadConfig({
      BOT_RUNTIMES_JSON: JSON.stringify([
        {
          id: "march8-tg",
          channel: "telegram",
          campaignId: "march8-razresheno"
        },
        {
          id: "march8-max",
          channel: "max",
          campaignId: "march8-razresheno"
        }
      ]),
      DEFAULT_BOT_ID: "march8-tg",
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      PORT: "3001",
      RENDER_OUTPUT_DIR: ".local-renders"
    })
  );

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/max/march8-max",
    payload: {
      update_type: "bot_started",
      timestamp: 1573226679188,
      chat_id: 777,
      user: {
        user_id: 777,
        name: "Max User",
        username: "max_user"
      },
      payload: "entry"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });

  const maxContext = app.appContexts["march8-max"];
  const session = await maxContext.sessionStore.get("777");
  assert.equal(session?.tgUserId, "777");
  assert.equal(session?.chatId, "777");
});

test("max webhook validates runtime secret when configured", async (t) => {
  const app = buildApp(
    loadConfig({
      BOT_RUNTIMES_JSON: JSON.stringify([
        {
          id: "march8-max",
          channel: "max",
          campaignId: "march8-razresheno",
          webhookSecret: "top-secret"
        }
      ]),
      DEFAULT_BOT_ID: "march8-max",
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      PORT: "3001",
      RENDER_OUTPUT_DIR: ".local-renders"
    })
  );

  t.after(async () => {
    await app.close();
  });

  const rejected = await app.inject({
    method: "POST",
    url: "/webhooks/max/march8-max",
    payload: {
      update_type: "bot_started",
      chat_id: 777,
      user: {
        user_id: 777,
        name: "Max User"
      }
    }
  });

  assert.equal(rejected.statusCode, 200);
  assert.deepEqual(rejected.json(), { ok: false, error: "invalid_secret" });

  const accepted = await app.inject({
    method: "POST",
    url: "/webhooks/max/march8-max",
    headers: {
      "x-max-bot-api-secret": "top-secret"
    },
    payload: {
      update_type: "bot_started",
      chat_id: 777,
      user: {
        user_id: 777,
        name: "Max User"
      }
    }
  });

  assert.equal(accepted.statusCode, 200);
  assert.deepEqual(accepted.json(), { ok: true });
});

test("normalize MAX callback keeps user-scoped reply target", async (t) => {
  const app = buildApp(
    loadConfig({
      BOT_RUNTIMES_JSON: JSON.stringify([
        {
          id: "march8-max",
          channel: "max",
          campaignId: "march8-razresheno"
        }
      ]),
      DEFAULT_BOT_ID: "march8-max",
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      PORT: "3001",
      RENDER_OUTPUT_DIR: ".local-renders"
    })
  );

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/max/march8-max",
    payload: {
      update_type: "message_callback",
      timestamp: 1774977000000,
      callback: {
        payload: "START_NEW",
        user: {
          user_id: 70722561,
          name: "Ilya"
        },
        message: {
          recipient: {
            chat_id: 250645149
          },
          message_id: 101
        }
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });

  const session = await app.appContexts["march8-max"].sessionStore.get("70722561");
  assert.equal(session?.chatId, "70722561");
  assert.equal(session?.lastCallbackData, "START_NEW");
});

import test from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

test("loadConfig parses multiple bot runtimes from BOT_RUNTIMES_JSON", () => {
  const config = loadConfig({
    BOT_RUNTIMES_JSON: JSON.stringify([
      {
        id: "march8",
        campaignId: "march8-razresheno",
        telegramBotToken: "111:aaa"
      },
      {
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
  assert.equal(config.botRuntimes.birthday?.telegramBotToken, "222:bbb");
});

test("internal state exposes all configured bot runtimes", async (t) => {
  const app = buildApp(
    loadConfig({
      BOT_RUNTIMES_JSON: JSON.stringify([
        {
          id: "march8",
          campaignId: "march8-razresheno"
        },
        {
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
          id: "march8",
          campaignId: "march8-razresheno"
        },
        {
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

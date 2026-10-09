// In production the server's own AI keys go only to SERVER_AI_EMAILS. The key
// here is fake and Anthropic's URL points at a closed port, so an allowed user
// gets "unavailable" (the server key was tried) and everyone else "no_provider".

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";

let app;
const OWNER = 1;
const STRANGER = 2;

before(async () => {
  app = await startApp({
    env: {
      ANTHROPIC_API_KEY: "sk-ant-test-not-a-real-key",
      ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
      SERVER_AI_EMAILS: "Owner@Test.com",
    },
  });
  await app.addUsers({ id: OWNER, email: "owner@test.com" }, { id: STRANGER, email: "stranger@test.com" });
});

after(() => app?.stop());

describe("server AI keys", () => {
  const body = { resumeText: "r", jobText: "j" };

  it("an allowlisted user falls back to them (email match is case-insensitive)", async () => {
    const res = await app.req("POST", "/api/cover-letter", { as: OWNER, body });
    assert.equal(res.status, 503);
    assert.equal(res.data.code, "unavailable");
  });

  it("any other signed-in user is told to connect a provider", async () => {
    const res = await app.req("POST", "/api/cover-letter", { as: STRANGER, body });
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "no_provider");
  });

  it("the nav status reflects who can use AI", async () => {
    const owner = (await app.req("GET", "/api/auth/me", { as: OWNER })).data.user.aiStatus;
    assert.deepEqual([owner.connected, owner.source, owner.providerName], [true, "server", "Claude"]);
    const stranger = (await app.req("GET", "/api/auth/me", { as: STRANGER })).data.user.aiStatus;
    assert.equal(stranger.connected, false);
  });
});

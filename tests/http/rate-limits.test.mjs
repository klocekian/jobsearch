// Per-user hourly allowances, set tiny here: AI calls and outside page fetches
// stop with 429 once used up, and one user's use doesn't count against another.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";

let app;

before(async () => {
  app = await startApp({
    env: {
      RATE_LIMIT_AI_PER_HOUR: "1",
      RATE_LIMIT_FETCH_PER_HOUR: "2",
      // A server key that goes nowhere, so an AI call is attempted and fails fast.
      ANTHROPIC_API_KEY: "sk-ant-test-not-a-real-key",
      ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
      SERVER_AI_EMAILS: "a@test,b@test",
    },
  });
  await app.addUsers({ id: 1, email: "a@test" }, { id: 2, email: "b@test" });
});

after(() => app?.stop());

describe("rate limits", () => {
  it("AI calls stop at the hourly allowance, with a readable message", async () => {
    const body = { resumeText: "r", jobText: "j" };
    assert.equal((await app.req("POST", "/api/cover-letter", { as: 1, body })).status, 503); // attempted
    const limited = await app.req("POST", "/api/cover-letter", { as: 1, body });
    assert.equal(limited.status, 429);
    assert.match(limited.data.error, /hourly limit for AI requests/);
  });

  it("page fetches stop at the allowance and say when to retry", async () => {
    // .invalid never resolves, so these fail fast after spending the allowance.
    for (let i = 0; i < 2; i++) {
      assert.equal((await app.req("POST", "/api/fetch-job", { as: 1, body: { url: "http://jobs.invalid/a" } })).status, 400);
    }
    const limited = await app.req("POST", "/api/fetch-job", { as: 1, body: { url: "http://jobs.invalid/a" } });
    assert.equal(limited.status, 429);
    assert.equal(limited.data.code, "rate_limited");
    const retryAfter = Number(limited.headers.get("retry-after"));
    assert.ok(retryAfter > 0 && retryAfter <= 3600, String(retryAfter));
    // The posting check draws on the same allowance.
    const job = await app.req("POST", "/api/jobs", { as: 1, body: { company: "Acme", title: "Eng", url: "http://jobs.invalid/b" } });
    assert.equal((await app.req("POST", "/api/jobs/check-status", { as: 1, body: { job_id: job.data.job.id } })).status, 429);
  });

  it("each user has their own allowance", async () => {
    assert.equal((await app.req("POST", "/api/fetch-job", { as: 2, body: { url: "http://jobs.invalid/a" } })).status, 400);
    assert.equal((await app.req("POST", "/api/cover-letter", { as: 2, body: { resumeText: "r", jobText: "j" } })).status, 503);
  });
});

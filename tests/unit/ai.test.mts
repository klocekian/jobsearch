// The AI layer against faked provider responses: credential resolution, retry,
// error classification, structured-output repair, model fallback, streaming.

import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsearch-ai-"));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
const env = process.env as Record<string, string | undefined>;
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_REFRESH_TOKEN", "ANTHROPIC_BASE_URL", "GEMINI_API_KEY", "GROK_API_KEY", "XAI_API_KEY", "MISTRAL_API_KEY", "SERVER_AI_EMAILS"]) {
  delete env[k];
}

const { getDb } = await import("@/lib/db");
const ai = await import("@/lib/ai");
const { normalizeFitnessPayload } = await import("@/lib/fitness/normalize");
const { upsertUserAIProvider } = await import("@/lib/db/ai-providers");

// ── fake network ──
type Body = Record<string, unknown> & { model?: string; tool_choice?: string; tools?: { function: { name: string } }[]; max_tokens?: number };
type Handler = (url: string, body: Body) => Response | Promise<Response>;
let handler: Handler = () => new Response("no handler", { status: 500 });
const calls: { url: string; body: Body }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let raw = init?.body;
  if (input instanceof Request && !raw) raw = await input.clone().text();
  let body: Body = {};
  try { body = raw ? JSON.parse(String(raw)) : {}; } catch {}
  calls.push({ url, body });
  return handler(url, body);
}) as typeof fetch;
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
const failure = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e as InstanceType<typeof ai.AIError>; }
  assert.fail("expected the call to throw");
};

const Schema = z.object({ score: z.number(), note: z.string() });
const opts = { system: "sys", prompt: "p", schema: Schema, schemaName: "TestResult" };

before(async () => {
  const db = await getDb();
  await db.execute("INSERT OR IGNORE INTO users (id, email, name) VALUES (1, 'a@t', 'A'), (2, 'b@t', 'B'), (3, 'c@t', 'C'), (4, 'Owner@Example.com', 'O')");
  await db.execute("UPDATE users SET anthropic_token = 'sk-ant-legacy' WHERE id = 3");
});
beforeEach(() => { calls.length = 0; });

describe("credentials", () => {
  it("no provider anywhere is no_provider (409)", async () => {
    const err = await failure(ai.resolveAICredentials(1));
    assert.deepEqual([err.kind, ai.aiErrorStatus(err)], ["no_provider", 409]);
  });

  it("server keys: SERVER_AI_EMAILS in production, everyone in development", async () => {
    env.GEMINI_API_KEY = "g-env";
    env.SERVER_AI_EMAILS = "owner@example.com, someone@else.com";
    assert.equal((await ai.resolveAICredentials(4)).provider, "gemini");
    assert.equal((await failure(ai.resolveAICredentials(1))).kind, "no_provider");
    assert.equal((await ai.getUserAIStatus(4)).source, "server");
    assert.equal((await ai.getUserAIStatus(1)).connected, false);

    delete env.SERVER_AI_EMAILS;
    env.NODE_ENV = "production";
    assert.equal((await failure(ai.resolveAICredentials(4))).kind, "no_provider");
    env.NODE_ENV = "development";
    assert.equal((await ai.resolveAICredentials(1)).provider, "gemini");
  });

  it("a stored retired model falls back to the current default", async () => {
    await upsertUserAIProvider({ userId: 2, provider: "claude", apiKey: "sk-ant-stored", model: "claude-3-7-sonnet-20250219", isActive: true });
    const creds = await ai.resolveAICredentials(2);
    assert.deepEqual([creds.provider, creds.model], ["claude", "claude-opus-5"]);
  });

  it("the legacy users.anthropic_token still works", async () => {
    const creds = await ai.resolveAICredentials(3);
    assert.deepEqual([creds.provider, creds.apiKey], ["claude", "sk-ant-legacy"]);
    assert.equal((await ai.getUserAIStatus(3)).providerName, "Claude");
  });

  it("the user's own provider beats the server's keys", async () => {
    await upsertUserAIProvider({ userId: 1, provider: "mistral", apiKey: "m-key", model: "open-mistral-nemo", isActive: true });
    assert.equal((await ai.resolveAICredentials(1)).provider, "mistral");
  });
});

describe("gemini", () => {
  before(() => upsertUserAIProvider({ userId: 1, provider: "gemini", apiKey: "g-key", model: "gemini-2.0-flash", isActive: true }));

  it("retries 429s, strips fences and unwraps a wrapper object", async () => {
    let n = 0;
    handler = () => (++n < 3
      ? json({ error: { message: "slow down" } }, 429)
      : json({ candidates: [{ content: { parts: [{ text: '```json\n{"result": {"score": 7, "note": "ok"}}\n```' }] } }] }));
    const res = await ai.generateStructured(1, opts);
    assert.deepEqual([n, res.data, res.provider], [3, { score: 7, note: "ok" }, "gemini"]);
  });

  it("a rejected key is auth / 502 — our own 401 means not signed in", async () => {
    handler = () => json({ error: { message: "API key not valid" } }, 401);
    const err = await failure(ai.generateStructured(1, opts));
    assert.deepEqual([err.kind, ai.aiErrorStatus(err)], ["auth", 502]);
    assert.match(err.message, /Profile > AI/);
  });

  it("an answer of the wrong shape is bad_output", async () => {
    handler = () => json({ candidates: [{ content: { parts: [{ text: '{"score": "high"}' }] } }] });
    assert.equal((await failure(ai.generateStructured(1, opts))).kind, "bad_output");
  });

  it("streams server-sent events as text", async () => {
    handler = () => new Response('data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n\n');
    const { stream } = await ai.streamText(1, { prompt: "hi" });
    assert.equal(await new Response(stream).text(), "Hello");
  });
});

describe("mistral (OpenAI-compatible)", () => {
  before(() => upsertUserAIProvider({ userId: 1, provider: "mistral", apiKey: "m-key", model: "open-mistral-7b", isActive: true }));

  it("falls back to the next model, reads tool-call arguments, applies the caller's normalize", async () => {
    handler = (_url, body) => body.model === "open-mistral-7b"
      ? json({ message: "model not found" }, 404)
      : json({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ hardStop: true, oneLine: "x", requirements: [{}] }) } }] } }] });
    const FitLike = z.object({ hard_stop: z.boolean(), one_line: z.string(), stated_minimums: z.array(z.object({})) });
    const res = await ai.generateStructured(1, { prompt: "p", schema: FitLike, schemaName: "FitnessResult", normalize: normalizeFitnessPayload });
    assert.equal(res.model, "open-mistral-nemo");
    assert.deepEqual(res.data, { hard_stop: true, one_line: "x", stated_minimums: [{}] });
    // 7b via tools, 7b via JSON mode, then nemo via tools.
    assert.equal(calls.length, 3);
    assert.deepEqual([calls[2].body.tool_choice, calls[2].body.tools?.[0].function.name], ["any", "FitnessResult"]);
  });

  it("a bad key fails once instead of walking the fallback list", async () => {
    handler = () => json({ message: "Unauthorized" }, 401);
    assert.equal((await failure(ai.generateStructured(1, opts))).kind, "auth");
    assert.equal(calls.length, 1);
  });

  it("streams server-sent events as text", async () => {
    handler = () => new Response('data: {"choices":[{"delta":{"content":"a"}}]}\n\ndata: {"choices":[{"delta":{"content":"b"}}]}\n\ndata: [DONE]\n\n');
    assert.equal(await new Response((await ai.streamText(1, { prompt: "x" })).stream).text(), "ab");
  });
});

describe("claude (SDK)", () => {
  const message = (content: unknown[], stop_reason = "end_turn") =>
    json({ id: "m", type: "message", role: "assistant", model: "claude-opus-5", content, stop_reason, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });

  it("parses structured output, on the current model with room for thinking", async () => {
    handler = () => message([{ type: "text", text: JSON.stringify({ score: 9, note: "great" }) }]);
    const res = await ai.generateStructured(2, opts);
    assert.deepEqual([res.data, res.provider, res.model], [{ score: 9, note: "great" }, "claude", "claude-opus-5"]);
    assert.equal(calls[0].body.model, "claude-opus-5");
    assert.ok((calls[0].body.max_tokens ?? 0) >= 16000);
  });

  it("a refusal is rejected", async () => {
    handler = () => message([], "refusal");
    const err = await failure(ai.generateStructured(2, opts));
    assert.deepEqual([err.kind, err.message], ["rejected", "Claude declined this request."]);
  });

  it("SDK errors map to kinds; a stream surfaces them before returning", async () => {
    handler = () => json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401);
    assert.equal((await failure(ai.generateStructured(2, opts))).kind, "auth");
    handler = () => json({ type: "error", error: { type: "rate_limit_error", message: "slow" } }, 429, { "retry-after": "0" });
    const err = await failure(ai.generateStructured(2, opts));
    assert.deepEqual([err.kind, ai.aiErrorStatus(err)], ["rate_limit", 429]);
    assert.equal((await failure(ai.streamText(2, { prompt: "x" }))).kind, "rate_limit");
  });
});

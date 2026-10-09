// The job rules in lib/services/jobs.ts, exercised through both front doors —
// the API routes and the MCP endpoint — plus the AI routes' error contract.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";

let app;
let jobId;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

before(async () => {
  app = await startApp();
  await app.addUsers({ id: 1, email: "a@test" });
});

after(() => app?.stop());

describe("API", () => {
  it("creating a job as applied stamps applied_at and normalizes HTML postings", async () => {
    const res = await app.req("POST", "/api/jobs", {
      body: { company: "Acme", title: "Eng", url: "https://acme.test/1", status: "applied", posting_text: "<p>Build things</p><ul><li>TypeScript</li><li>SQL</li></ul>" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.job.applied_at, today);
    assert.doesNotMatch(res.data.job.posting_text, /</);
    jobId = res.data.job.id;
  });

  it("the same company + title merges into the tracked job", async () => {
    const res = await app.req("POST", "/api/jobs", { body: { company: "acme", title: "eng", location: "Remote", posting_text: "Build things. A much longer and cleaner posting than before." } });
    assert.deepEqual([res.status, res.data.merged, res.data.job.id, res.data.job.location], [200, true, jobId, "Remote"]);
  });

  it("statuses outside STATUS_OPTIONS are rejected", async () => {
    assert.equal((await app.req("POST", "/api/jobs", { body: { company: "X", status: "bogus" } })).status, 400);
    assert.equal((await app.req("PATCH", `/api/jobs/${jobId}`, { body: { status: "bogus" } })).status, 400);
  });

  it("an empty PATCH returns the job unchanged", async () => {
    assert.equal((await app.req("PATCH", `/api/jobs/${jobId}`, { body: {} })).data.job.id, jobId);
  });

  it("a closing status remembers the previous one; reopening clears it", async () => {
    const closed = await app.req("PATCH", `/api/jobs/${jobId}`, { body: { status: "withdrawn" } });
    assert.deepEqual([closed.data.job.status, closed.data.job.previous_status], ["withdrawn", "applied"]);
    assert.equal((await app.req("PATCH", `/api/jobs/${jobId}`, { body: { status: "interview2" } })).data.job.previous_status, null);
    assert.equal((await app.req("PATCH", `/api/jobs/${jobId}`, { body: { is_starred: 1 } })).data.job.is_starred, 1);
  });

  it("rule-based fitness runs and is saved", async () => {
    const res = await app.req("POST", "/api/fitness-check", { body: { job_id: jobId } });
    assert.equal(res.status, 200);
    assert.equal(res.data.model, "deterministic:rule-based");
    assert.equal(typeof res.data.run_id, "number");
  });

  it("AI fitness without candidate docs says which are missing", async () => {
    const res = await app.req("POST", "/api/fitness-check", { body: { job_id: jobId, use_ai: true } });
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "missing_candidate_docs");
    assert.deepEqual(res.data.missing, ["positive profile", "negative profile (gaps)"]);
  });

  it("fitness on a job with no posting is 422", async () => {
    const empty = await app.req("POST", "/api/jobs", { body: { company: "Empty", title: "NoPosting" } });
    assert.equal((await app.req("POST", "/api/fitness-check", { body: { job_id: empty.data.job.id } })).status, 422);
  });
});

describe("MCP", () => {
  let token;
  let rpcId = 0;
  async function rpc(method, params) {
    const res = await fetch(`${app.base}/api/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
    const text = await res.text();
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    return JSON.parse(line ? line.slice(5) : text);
  }
  async function call(name, args) {
    const result = (await rpc("tools/call", { name, arguments: args })).result;
    const text = result.content[0].text;
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { isError: !!result.isError, text, data };
  }

  before(async () => {
    token = (await app.req("POST", "/api/mcp-settings", { body: { action: "create_token", label: "test" } })).data.token;
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  });

  it("tool schemas come from the shared job schema", async () => {
    const tools = (await rpc("tools/list", {})).result.tools;
    const add = tools.find((t) => t.name === "add_job").inputSchema;
    assert.deepEqual(add.required.sort(), ["company", "title"]);
    assert.ok(add.properties.status.enum.includes("interview2"));
    assert.equal(add.properties.status.description, "Defaults to saved.");
    const update = tools.find((t) => t.name === "update_job").inputSchema;
    assert.equal(update.properties.notes.description, "Replaces the notes entirely.");
    assert.ok(update.properties.append_note);
    assert.deepEqual(update.required, ["job_id"]);
  });

  it("add_job creates, and merges into a job the API created", async () => {
    const created = await call("add_job", { company: "Globex", title: "PM", status: "applied" });
    assert.deepEqual([created.isError, created.data.merged, created.data.job.applied_at], [false, false, today]);
    const merged = await call("add_job", { company: "ACME", title: "ENG", salary_text: "$200k" });
    assert.deepEqual([merged.data.merged, merged.data.job.id, merged.data.job.salary], [true, jobId, "$200k"]);

    const updated = await call("update_job", { job_id: created.data.job.id, starred: true, append_note: "Phone screen booked" });
    assert.equal(updated.data.job.starred, true);
    assert.equal((await call("get_job", { job_id: created.data.job.id })).data.notes, `[${today}] Phone screen booked`);
    assert.equal((await call("update_job", { job_id: created.data.job.id })).text, "Nothing to update.");
  });

  it("fitness: rule-based run, brief needs both docs, report header filled from the job", async () => {
    assert.equal((await call("run_fitness_check", { job_id: jobId })).isError, false);
    const brief = await call("get_fitness_brief", { job_id: jobId });
    assert.equal(brief.isError, true);
    assert.match(brief.text, /^The fitness check needs .*update_candidate_doc/);
    await call("update_candidate_doc", { kind: "profile", content: "Built things." });
    await call("update_candidate_doc", { kind: "gaps", content: "No Rust." });
    assert.equal((await call("get_fitness_brief", { job_id: jobId })).isError, false);
    const saved = await call("save_fitness_report", { job_id: jobId, report: { score: 6 }, model: "x" });
    assert.equal(saved.isError, false);
    assert.match(saved.text, /Acme/);
    assert.match(saved.text, /\$200k/);
  });

  it("pipeline summary counts interview2 as active", async () => {
    assert.equal((await call("pipeline_summary", {})).data.active, 3);
  });
});

describe("AI routes with no provider", () => {
  it("answer 409 no_provider with a readable message", async () => {
    const res = await app.req("POST", "/api/cover-letter", { body: { resumeText: "r", jobText: "j" } });
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "no_provider");
    assert.match(res.data.error, /^No AI provider/);
    for (const [path, body] of [
      ["/api/rewrite-resume", { resumeText: "r", jobText: "j" }],
      ["/api/ai-detection", { resumeText: "r" }],
      ["/api/parse-resume", { resumeText: "r" }],
      ["/api/jobs/extract", { text: "t" }],
      ["/api/fitness-check", { job_id: jobId, use_ai: true }],
    ]) {
      assert.equal((await app.req("POST", path, { body })).status, 409, path);
    }
  });

  it("an invalid body is a 400 with a message", async () => {
    const res = await app.req("POST", "/api/cover-letter", { body: { resumeText: "" } });
    assert.equal(res.status, 400);
    assert.equal(typeof res.data.error, "string");
  });
});

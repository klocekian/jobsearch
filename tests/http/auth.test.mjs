// Every user-facing API route requires a session, and no user can reach
// another user's jobs, resumes or submissions.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";

let app;
const A = 1;
const B = 2;
let jobId, resumeId, submissionId;

before(async () => {
  app = await startApp();
  await app.addUsers({ id: A, email: "a@test" }, { id: B, email: "b@test" });

  const job = await app.req("POST", "/api/jobs", { as: A, body: { company: "Acme", title: "Eng", url: "https://acme.test/1" } });
  assert.equal(job.status, 201);
  jobId = job.data.job.id;
  resumeId = (await app.req("POST", "/api/resumes", { as: A, body: { name: "A resume", content: "Jane Doe", is_default: true } })).data.resume.id;
  await app.req("POST", "/api/resumes", { as: B, body: { name: "B resume", content: "John Roe", is_default: true } });
  const sub = await app.req("POST", `/api/jobs/${jobId}/submissions`, { as: A, body: { label: "cl", content: "hi" } });
  assert.equal(sub.status, 201);
  submissionId = sub.data.submission.id;
  // An auto-closed job, as the posting check leaves it.
  await app.db.execute({ sql: "UPDATE jobs SET status = 'closed', previous_status = 'applied' WHERE id = ?", args: [jobId] });
});

after(() => app?.stop());

describe("signed out", () => {
  const routes = () => [
    ["GET", "/api/jobs"],
    ["POST", "/api/jobs", { company: "X" }],
    ["GET", `/api/jobs/${jobId}`],
    ["PATCH", `/api/jobs/${jobId}`, { notes: "x" }],
    ["DELETE", `/api/jobs/${jobId}`],
    ["GET", `/api/resumes/${resumeId}`],
    ["GET", `/api/jobs/${jobId}/submissions/${submissionId}`],
    ["GET", "/api/jobs/check-status"],
    ["POST", "/api/jobs/check-status", { action: "undo" }],
    ["POST", "/api/jobs/check-status", { action: "confirm", job_ids: [jobId] }],
    ["GET", "/api/candidate-docs"],
    ["POST", "/api/cover-letter", {}],
    ["POST", "/api/rewrite-resume", {}],
    ["POST", "/api/ai-detection", {}],
    ["POST", "/api/parse-resume", {}],
    ["POST", "/api/fetch-job", {}],
    ["POST", "/api/jobs/extract", {}],
    ["POST", "/api/jobs/apply", {}],
    ["POST", "/api/jobs/import", {}],
    ["POST", "/api/fitness-check", {}],
    ["GET", "/api/profile/autofill"],
    ["GET", "/api/ai/providers"],
    ["GET", "/api/mcp-settings"],
  ];

  it("every user route answers 401", async () => {
    for (const [method, path, body] of routes()) {
      const res = await app.req(method, path, { as: null, body });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  it("a malformed session cookie is 401, not 500", async () => {
    const res = await app.req("GET", "/api/jobs", { as: null, headers: { Cookie: "jbs_session=1.abc" } });
    assert.equal(res.status, 401);
  });

  it("/jobs with a bad cookie redirects to /login", async () => {
    const res = await app.req("GET", "/jobs", { as: null, headers: { Cookie: "jbs_session=1.abc" } });
    assert.match(res.headers.get("location") ?? "", /\/login$/);
  });
});

describe("another user's records", () => {
  it("jobs: read, edit and delete are 404", async () => {
    assert.equal((await app.req("GET", `/api/jobs/${jobId}`, { as: B })).status, 404);
    assert.equal((await app.req("PATCH", `/api/jobs/${jobId}`, { as: B, body: { notes: "pwned" } })).status, 404);
    assert.equal((await app.req("DELETE", `/api/jobs/${jobId}`, { as: B })).status, 404);
  });

  it("resumes: read, edit, tag and delete are 404", async () => {
    assert.equal((await app.req("GET", `/api/resumes/${resumeId}`, { as: B })).status, 404);
    assert.equal((await app.req("PATCH", `/api/resumes/${resumeId}`, { as: B, body: { name: "pwned" } })).status, 404);
    assert.equal((await app.req("PATCH", `/api/resumes/${resumeId}`, { as: B, body: { add_tag: "pwned" } })).status, 404);
    assert.equal((await app.req("DELETE", `/api/resumes/${resumeId}`, { as: B })).status, 404);
  });

  it("submissions: read, delete and add are 404", async () => {
    assert.equal((await app.req("GET", `/api/jobs/${jobId}/submissions/${submissionId}`, { as: B })).status, 404);
    assert.equal((await app.req("DELETE", `/api/jobs/${jobId}/submissions/${submissionId}`, { as: B })).status, 404);
    assert.equal((await app.req("POST", `/api/jobs/${jobId}/submissions`, { as: B, body: { label: "x" } })).status, 404);
  });

  it("closed-job restore and confirm touch only your own jobs", async () => {
    assert.equal((await app.req("GET", "/api/jobs/check-status", { as: B })).data.restorableCount, 0);
    assert.equal((await app.req("POST", "/api/jobs/check-status", { as: B, body: { action: "confirm", job_ids: [jobId] } })).data.confirmed, 0);
    assert.equal((await app.req("POST", "/api/jobs/check-status", { as: B, body: { action: "undo" } })).data.restored, 0);
    assert.equal((await app.req("GET", "/api/jobs/check-status", { as: A })).data.restorableCount, 1);
  });

  it("lists show only your own jobs", async () => {
    assert.equal((await app.req("GET", "/api/jobs", { as: B })).data.jobs.length, 0);
  });

  it("making a resume default leaves other users' defaults alone", async () => {
    await app.req("POST", "/api/resumes", { as: B, body: { name: "B second", content: "x", is_default: true } });
    assert.equal((await app.req("GET", `/api/resumes/${resumeId}`, { as: A })).data.resume.is_default, 1);
    assert.equal((await app.req("GET", "/api/candidate-docs", { as: B })).data.default_resume.name, "B second");
  });
});

describe("your own records", () => {
  it("confirming an auto-closed job makes it final", async () => {
    assert.equal((await app.req("POST", "/api/jobs/check-status", { as: A, body: { action: "confirm", job_ids: [jobId] } })).data.confirmed, 1);
    assert.equal((await app.req("GET", "/api/jobs/check-status", { as: A })).data.restorableCount, 0);
  });

  it("jobs can be read and edited", async () => {
    assert.equal((await app.req("GET", `/api/jobs/${jobId}`, { as: A })).status, 200);
    assert.equal((await app.req("PATCH", `/api/jobs/${jobId}`, { as: A, body: { status: "applied" } })).data.job.status, "applied");
  });

  it("submissions are scoped to their job", async () => {
    assert.equal((await app.req("GET", `/api/jobs/${jobId}/submissions/${submissionId}`, { as: A })).status, 200);
    assert.equal((await app.req("GET", `/api/jobs/999/submissions/${submissionId}`, { as: A })).status, 404);
    assert.equal((await app.req("DELETE", `/api/jobs/${jobId}/submissions/${submissionId}`, { as: A })).status, 200);
  });

  it("resumes can be tagged; jobs deleted", async () => {
    assert.equal((await app.req("PATCH", `/api/resumes/${resumeId}`, { as: A, body: { add_tag: "Acme" } })).data.resume.tags, '["Acme"]');
    assert.equal((await app.req("DELETE", `/api/jobs/${jobId}`, { as: A })).status, 200);
  });
});

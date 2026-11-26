import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";

let app;
before(async () => {
  app = await startApp();
  await app.addUsers({ id: 1, email: "search-a@test" }, { id: 2, email: "search-b@test" });
});
after(() => app?.stop());

describe("preparation space", () => {
  const plan = { focus: "Design leadership", learning: "Practice a metrics story", feedback: "Recruiter asked about team scope" };
  it("requires authentication for reads and writes", async () => {
    assert.equal((await app.req("GET", "/api/search-plan", { as: null })).status, 401);
    assert.equal((await app.req("PUT", "/api/search-plan", { as: null, body: plan })).status, 401);
  });
  it("persists notes for the session owner only", async () => {
    assert.equal((await app.req("PUT", "/api/search-plan", { body: { ...plan, user_id: 2 } })).status, 200);
    assert.deepEqual((await app.req("GET", "/api/search-plan")).data.plan, plan);
    assert.deepEqual((await app.req("GET", "/api/search-plan", { as: 2 })).data.plan, { focus: "", learning: "", feedback: "" });
  });
  it("rejects malformed and oversized writes without replacing saved notes", async () => {
    assert.equal((await app.req("PUT", "/api/search-plan", { body: { focus: [] } })).status, 400);
    assert.equal((await app.req("PUT", "/api/search-plan", { body: { ...plan, learning: "x".repeat(20001) } })).status, 400);
    assert.deepEqual((await app.req("GET", "/api/search-plan")).data.plan, plan);
  });
  it("finds patterns only in the owner's exploratory postings", async () => {
    for (const [company, status, as] of [["First", "saved", 1], ["Second", "applying", 1], ["Old", "rejected", 1], ["Other user", "saved", 2]]) {
      await app.req("POST", "/api/jobs", { as, body: { company, title: "Engineer", status, posting_text: "Research and prototyping" } });
    }
    const result = await app.req("GET", "/api/search-plan");
    assert.equal(result.data.postingCount, 2);
    assert.ok(result.data.patterns.length > 0);
    for (const pattern of result.data.patterns) assert.deepEqual(pattern.jobs.map((j) => j.company).sort(), ["First", "Second"]);
    const other = await app.req("GET", "/api/search-plan", { as: 2 });
    assert.equal(other.data.postingCount, 1);
    assert.deepEqual(other.data.patterns, []);
  });
});

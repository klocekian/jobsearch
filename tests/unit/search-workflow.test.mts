import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applicationGroup, recurringSkills } from "@/lib/search-workflow";

describe("search phases", () => {
  it("keeps ended applications, but excludes roles closed before applying", () => {
    const job = { status: "closed", previous_status: "saved", applied_at: null };
    assert.equal(applicationGroup(job), null);
    assert.equal(applicationGroup({ ...job, previous_status: "interview2" }), "finished");
    assert.equal(applicationGroup({ ...job, previous_status: null, applied_at: "2026-11-20" }), "finished");
    assert.equal(applicationGroup({ ...job, status: "applying" }), "preparing");
    assert.equal(applicationGroup({ ...job, status: "interview" }), "conversation");
    assert.equal(applicationGroup({ ...job, status: "applied" }), "waiting");
    assert.equal(applicationGroup({ ...job, status: "accepted" }), "finished");
  });
  it("counts distinct postings, not keyword repetition, and retains evidence", () => {
    const jobs = [
      { id: 1, company: "One", title: "Engineer", posting_text: "Research Research Research and prototyping" },
      { id: 2, company: "Two", title: "Developer", posting_text: "Research and data analysis" },
    ];
    const patterns = recurringSkills(jobs);
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].skill, "Research");
    assert.deepEqual(patterns[0].jobs.map((j) => j.id), [1, 2]);
    assert.deepEqual(recurringSkills(jobs.slice(0, 1)), []);
  });
});

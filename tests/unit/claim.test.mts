// Unowned rows go to a database's only user, never to whoever signs in next on
// a shared install.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsearch-claim-"));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;

const { getDb } = await import("@/lib/db");
const { claimUnownedJobs, createJob } = await import("@/lib/db/jobs");

describe("claimUnownedJobs", () => {
  it("adopts unowned rows for the only user", async () => {
    const db = await getDb();
    await db.execute("INSERT INTO users (id, email, name) VALUES (1, 'solo@test', 'Solo')");
    await createJob({ user_id: null, company: "Acme", title: "Eng" });
    assert.equal(await claimUnownedJobs(1), 1);
  });

  it("does nothing once a second user exists", async () => {
    const db = await getDb();
    await db.execute("INSERT INTO users (id, email, name) VALUES (2, 'other@test', 'Other')");
    await createJob({ user_id: null, company: "Globex", title: "PM" });
    assert.equal(await claimUnownedJobs(2), 0);
    const owner = await db.execute("SELECT user_id FROM jobs WHERE company = 'Globex'");
    assert.equal(owner.rows[0].user_id, null);
  });
});

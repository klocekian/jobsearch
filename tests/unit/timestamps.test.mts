// Job timestamps used to be Los Angeles wall-clock time; they're converted to
// UTC once, and new ones are written in UTC.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jobsearch-ts-")), "old.db");
process.env.TURSO_DATABASE_URL = `file:${file}`;

describe("job timestamps", () => {
  it("converts Los Angeles wall time to UTC across DST", async () => {
    const { pacificWallTimeToUtc } = await import("@/lib/db");
    assert.equal(pacificWallTimeToUtc("2026-01-15 10:00:00"), "2026-01-15 18:00:00"); // PST, UTC-8
    assert.equal(pacificWallTimeToUtc("2026-07-15 10:00:00"), "2026-07-15 17:00:00"); // PDT, UTC-7
    assert.equal(pacificWallTimeToUtc("2026-03-08 03:30:00"), "2026-03-08 10:30:00"); // just after spring-forward
    assert.equal(pacificWallTimeToUtc("2026-10-09 23:15:00"), "2026-10-10 06:15:00"); // crosses midnight UTC
    assert.equal(pacificWallTimeToUtc("2026-10-09"), null);
  });

  it("converts an old database once, leaving already-UTC updated_at alone", async () => {
    const old = createClient({ url: `file:${file}` });
    await old.executeMultiple(`
      CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, company TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'saved', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO jobs (company, created_at, updated_at) VALUES ('Never edited', '2026-07-15 10:00:00', '2026-07-15 10:00:00');
      INSERT INTO jobs (company, created_at, updated_at) VALUES ('Edited later', '2026-01-15 10:00:00', '2026-02-01 09:00:00');
    `);
    old.close();

    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const row = async (company: string) => (await db.execute({ sql: "SELECT created_at, updated_at FROM jobs WHERE company = ?", args: [company] })).rows[0];
    assert.deepEqual({ ...(await row("Never edited")) }, { created_at: "2026-07-15 17:00:00", updated_at: "2026-07-15 17:00:00" });
    assert.deepEqual({ ...(await row("Edited later")) }, { created_at: "2026-01-15 18:00:00", updated_at: "2026-02-01 09:00:00" });

    // A second startup (another instance) must not shift them again.
    const fresh = createClient({ url: `file:${file}` });
    const claim = await fresh.execute("SELECT value FROM settings WHERE key = 'jobs_timestamps_utc'");
    assert.equal(claim.rows[0].value, "1");
    fresh.close();
  });

  it("new jobs are stamped in UTC", async () => {
    const { createJob } = await import("@/lib/db/jobs");
    const before = new Date().toISOString().slice(0, 16).replace("T", " ");
    const job = await createJob({ company: "New", title: "Eng" });
    assert.equal(job.created_at.slice(0, 16), before);
  });
});

describe("formatDate", () => {
  it("reads stored timestamps as UTC and bare dates as calendar days", async () => {
    process.env.TZ = "America/Los_Angeles";
    const { formatDate } = await import("@/lib/format");
    assert.equal(formatDate("2026-10-10 06:15:00"), "Oct 9"); // 11:15pm in LA
    assert.equal(formatDate("2026-10-09"), "Oct 9");
    assert.equal(formatDate("2026-10-10T06:15:00.000Z"), "Oct 9");
    assert.equal(formatDate(null), "");
  });
});

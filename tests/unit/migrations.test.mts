// A database created before the newer columns existed gets them on startup.

import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jobsearch-migrate-")), "old.db");
process.env.TURSO_DATABASE_URL = `file:${file}`;

it("adds missing columns (and their index) to an old database", async () => {
  const old = createClient({ url: `file:${file}` });
  await old.executeMultiple(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '');
    CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, company TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'saved', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO jobs (company, title) VALUES ('Acme', 'Eng');
  `);
  old.close();

  const { getDb } = await import("@/lib/db");
  const db = await getDb();
  const cols = async (t: string) => (await db.execute(`PRAGMA table_info(${t})`)).rows.map((r) => String(r.name));
  for (const c of ["is_starred", "fitness_score", "fitness_report", "fitness_run_at", "match_resume_name", "activity_summary"]) {
    assert.ok((await cols("jobs")).includes(c), c);
  }
  assert.ok((await cols("users")).includes("mcp_oauth_epoch"));
  const job = await db.execute("SELECT is_starred FROM jobs WHERE company = 'Acme'");
  assert.equal(job.rows[0].is_starred, 0);
  const indexes = (await db.execute("PRAGMA index_list(jobs)")).rows.map((r) => String(r.name));
  assert.ok(indexes.includes("idx_jobs_starred"));
});

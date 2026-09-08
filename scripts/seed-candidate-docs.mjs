#!/usr/bin/env node
/**
 * Seed the candidate_docs table from local markdown files.
 *
 * The positive profile (the fact canon) and the negative profile (gaps, with
 * their standing reframes) start life as files. This moves them into the app,
 * which becomes the source of truth from that point on — keep the originals as
 * a dated archive, not as a second live copy.
 *
 * Usage:
 *   node scripts/seed-candidate-docs.mjs --profile <path> --gaps <path> [--email you@example.com]
 *
 * Paths are arguments, never hardcoded — nothing personal belongs in the repo.
 * Re-running overwrites the stored copy for that user, so this doubles as a
 * re-sync while the files are still the thing being edited.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const profilePath = arg("profile");
const gapsPath = arg("gaps");
const email = arg("email");

if (!profilePath && !gapsPath) {
  console.error(
    "Usage: node scripts/seed-candidate-docs.mjs --profile <path> --gaps <path> [--email you@example.com]",
  );
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:data/jobsearch.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS candidate_docs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_docs_user_kind ON candidate_docs(user_id, kind);
`);

// Resolve the owner. Getting this wrong writes docs the app will never read,
// so it's explicit rather than clever: named account, or the only account, or
// unowned (which is what a pre-login database looks like).
let userId = null;
if (email) {
  const r = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
  if (!r.rows[0]) {
    console.error(`No user with email ${email}. Log in to the app once first.`);
    process.exit(1);
  }
  userId = Number(r.rows[0].id);
} else {
  const r = await db.execute("SELECT id, email FROM users ORDER BY id LIMIT 2");
  if (r.rows.length === 1) {
    userId = Number(r.rows[0].id);
    console.log(`Seeding for the only account present: ${r.rows[0].email}`);
  } else if (r.rows.length > 1) {
    console.error("More than one account in this database — pass --email to say which.");
    process.exit(1);
  } else {
    console.log("No accounts yet — seeding as unowned (the first login will claim it).");
  }
}

async function upsert(kind, path) {
  const content = readFileSync(path, "utf8");
  const clause = userId != null ? "user_id = ?" : "user_id IS NULL";
  const args = userId != null ? [userId, kind] : [kind];
  const existing = await db.execute({
    sql: `SELECT id FROM candidate_docs WHERE ${clause} AND kind = ? LIMIT 1`,
    args,
  });
  if (existing.rows[0]) {
    await db.execute({
      sql: "UPDATE candidate_docs SET content = ?, updated_at = datetime('now') WHERE id = ?",
      args: [content, existing.rows[0].id],
    });
    console.log(`updated ${kind} (${content.length} chars) from ${path}`);
  } else {
    await db.execute({
      sql: "INSERT INTO candidate_docs (user_id, kind, content) VALUES (?, ?, ?)",
      args: [userId, kind, content],
    });
    console.log(`inserted ${kind} (${content.length} chars) from ${path}`);
  }
}

if (profilePath) await upsert("profile", profilePath);
if (gapsPath) await upsert("gaps", gapsPath);
console.log("done.");

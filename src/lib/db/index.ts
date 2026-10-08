import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

let _client: Client | null = null;
let _initialized = false;

export function getClient(): Client {
  if (_client) return _client;
  const dbUrl = process.env.TURSO_DATABASE_URL || "file:data/jobsearch.db";
  if (dbUrl.startsWith("file:")) {
    const filePath = dbUrl.slice("file:".length);
    const dir = path.dirname(filePath);
    if (dir && !fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
  }
  _client = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _client;
}

export async function getDb(): Promise<Client> {
  const client = getClient();
  if (_initialized) return client;

  // Single batch: tables + indexes.
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL DEFAULT '',
      anthropic_token TEXT,
      refresh_token   TEXT,
      token_expires   INTEGER,
      profile_data    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
      company       TEXT NOT NULL DEFAULT '',
      title         TEXT NOT NULL DEFAULT '',
      url           TEXT NOT NULL DEFAULT '',
      location      TEXT NOT NULL DEFAULT '',
      remote_type   TEXT NOT NULL DEFAULT '',
      salary_min    INTEGER,
      salary_max    INTEGER,
      salary_text   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'saved',
      posting_text  TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      source        TEXT NOT NULL DEFAULT 'manual',
      match_score   INTEGER,
      match_report  TEXT,
      previous_status TEXT,
      is_starred    INTEGER NOT NULL DEFAULT 0,
      fitness_score INTEGER,
      fitness_report TEXT,
      fitness_run_at TEXT,
      match_resume_name TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      applied_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      type        TEXT NOT NULL DEFAULT 'other',
      label       TEXT NOT NULL DEFAULT '',
      format      TEXT NOT NULL DEFAULT 'txt',
      content     TEXT NOT NULL DEFAULT '',
      file_path   TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT 'Untitled Resume',
      content     TEXT NOT NULL DEFAULT '',
      file_name   TEXT NOT NULL DEFAULT '',
      is_default  INTEGER NOT NULL DEFAULT 0,
      tags        TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidate_docs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_ai_providers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider    TEXT NOT NULL,
      api_key     TEXT NOT NULL,
      model       TEXT,
      is_active   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_starred ON jobs(is_starred);
    CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id);
    CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_docs_user_kind ON candidate_docs(user_id, kind);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ai_providers_user_provider ON user_ai_providers(user_id, provider);
  `);

  // Parallelize backward-compatibility migrations for existing DBs
  await Promise.allSettled([
    client.execute("ALTER TABLE jobs ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0"),
    client.execute("ALTER TABLE jobs ADD COLUMN fitness_score INTEGER"),
    client.execute("ALTER TABLE jobs ADD COLUMN fitness_report TEXT"),
    client.execute("ALTER TABLE jobs ADD COLUMN fitness_run_at TEXT"),
    client.execute("ALTER TABLE jobs ADD COLUMN match_resume_name TEXT"),
  ]);

  _initialized = true;
  return client;
}

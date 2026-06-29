import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;
let _initialized = false;

export function getClient(): Client {
  if (_client) return _client;
  _client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:data/jobsearch.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _client;
}

export async function getDb(): Promise<Client> {
  const client = getClient();
  if (_initialized) return client;

  // Core tables (IF NOT EXISTS is safe for new + existing DBs)
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL DEFAULT '',
      anthropic_token TEXT,
      refresh_token   TEXT,
      token_expires   INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
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
      name        TEXT NOT NULL DEFAULT 'Untitled Resume',
      content     TEXT NOT NULL DEFAULT '',
      file_name   TEXT NOT NULL DEFAULT '',
      is_default  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations — add columns to existing tables (safe to retry)
  const addColumns = [
    "ALTER TABLE jobs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE resumes ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE jobs ADD COLUMN previous_status TEXT",
  ];
  for (const sql of addColumns) {
    try { await client.execute(sql); } catch { /* already exists */ }
  }

  // Indexes (safe after columns exist)
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id)",
    "CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)",
  ];
  for (const sql of indexes) {
    try { await client.execute(sql); } catch { /* already exists */ }
  }

  _initialized = true;
  return client;
}

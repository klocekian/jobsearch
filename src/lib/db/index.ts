import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "jobsearch.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id);
  `);

  return _db;
}

import { createClient, type Client, type InStatement, type InValue, type Row } from "@libsql/client";
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

/**
 * Columns added after their table first shipped; databases created before then
 * lack them. An optional backfill runs once, right after its column is added.
 */
const ADDED_COLUMNS: [table: string, column: string, definition: string, backfill?: string][] = [
  ["jobs", "previous_status", "TEXT"],
  ["jobs", "is_starred", "INTEGER NOT NULL DEFAULT 0"],
  ["jobs", "fitness_score", "INTEGER"],
  ["jobs", "fitness_report", "TEXT"],
  ["jobs", "fitness_run_at", "TEXT"],
  ["jobs", "match_resume_name", "TEXT"],
  ["jobs", "activity_summary", "TEXT"],
  // Before this flag, a closed job remembering its previous status was taken to be an unconfirmed auto-closure.
  ["jobs", "auto_closed", "INTEGER NOT NULL DEFAULT 0", "UPDATE jobs SET auto_closed = 1 WHERE status = 'closed' AND previous_status IS NOT NULL AND previous_status != ''"],
  ["users", "mcp_oauth_epoch", "INTEGER NOT NULL DEFAULT 0"],
  ["users", "mcp_last_used_at", "TEXT"],
];

/**
 * Add whichever of ADDED_COLUMNS a database is missing. Checking first means a
 * failure here is real and propagates, rather than hiding among the expected
 * "duplicate column" errors from blindly re-running every ALTER.
 */
async function addMissingColumns(client: Client): Promise<void> {
  const tables = [...new Set(ADDED_COLUMNS.map(([table]) => table))];
  const existing = new Map(
    await Promise.all(
      tables.map(async (table) => {
        const info = await client.execute(`PRAGMA table_info(${table})`);
        return [table, new Set(info.rows.map((r) => String(r.name)))] as const;
      }),
    ),
  );
  for (const [table, column, definition, backfill] of ADDED_COLUMNS) {
    if (!existing.get(table)?.has(column)) {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      if (backfill) await client.execute(backfill);
    }
  }
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
      auto_closed   INTEGER NOT NULL DEFAULT 0,
      is_starred    INTEGER NOT NULL DEFAULT 0,
      fitness_score INTEGER,
      fitness_report TEXT,
      fitness_run_at TEXT,
      match_resume_name TEXT,
      activity_summary TEXT,
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

    CREATE TABLE IF NOT EXISTS api_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash    TEXT NOT NULL UNIQUE,
      label         TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id);
    CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_docs_user_kind ON candidate_docs(user_id, kind);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ai_providers_user_provider ON user_ai_providers(user_id, provider);
  `);

  await addMissingColumns(client);
  // Indexes on added columns can only be created once the column exists.
  await client.execute("CREATE INDEX IF NOT EXISTS idx_jobs_starred ON jobs(is_starred)");
  await convertJobTimestampsToUtc(client);

  _initialized = true;
  return client;
}

/**
 * "YYYY-MM-DD HH:MM:SS" read as Los Angeles wall-clock time, rewritten as the
 * same instant in UTC (same format). Null if the value isn't in that shape.
 */
export function pacificWallTimeToUtc(wall: string): string | null {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const la = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  // Start from the wall time taken as UTC and correct by however far Los
  // Angeles shows it from that wall time; twice settles DST transitions.
  let instant = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(la.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
    instant += wallAsUtc - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }
  return new Date(instant).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Jobs were stamped with Los Angeles wall-clock time on create, while every
 * other timestamp is UTC. Convert them once. The flag row is claimed inside the
 * write transaction, so two instances starting together can't both convert.
 */
async function convertJobTimestampsToUtc(client: Client): Promise<void> {
  const tx = await client.transaction("write");
  try {
    const claim = await tx.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('jobs_timestamps_utc', '1')");
    if (claim.rowsAffected === 0) {
      await tx.rollback();
      return;
    }
    const rows = (await tx.execute("SELECT id, created_at, updated_at FROM jobs")).rows;
    const updates: InStatement[] = [];
    for (const r of rows) {
      const created = pacificWallTimeToUtc(String(r.created_at));
      if (!created) continue;
      // An updated_at equal to created_at came from the same create; later updates were already UTC.
      const updated = r.updated_at === r.created_at ? created : String(r.updated_at);
      updates.push({ sql: "UPDATE jobs SET created_at = ?, updated_at = ? WHERE id = ?", args: [created, updated, r.id] });
    }
    if (updates.length) await tx.batch(updates);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/**
 * The ownership condition for a user's rows. `null` is the single-user local
 * database the stdio MCP server can run against, where rows have no owner.
 * HTTP routes always pass a real id (see withUser in lib/api-auth.ts).
 */
export function ownedBy(userId: number | null): { sql: string; args: InValue[] } {
  return userId != null ? { sql: "user_id = ?", args: [userId] } : { sql: "user_id IS NULL", args: [] };
}

/**
 * A result row as a plain object of its named columns. libsql's Row is
 * array-like (numeric indices and a `length` own property alongside the named
 * columns), which React's Server-to-Client serialization rejects; spreading
 * keeps just the named fields.
 */
export function plainRow<T>(row: Row): T {
  return { ...row } as unknown as T;
}

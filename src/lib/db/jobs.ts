import { getDb, ownedBy } from "./index";
import type { Row, InValue } from "@libsql/client";

export interface JobRow {
  id: number;
  user_id: number | null;
  company: string;
  title: string;
  url: string;
  location: string;
  remote_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_text: string;
  status: string;
  posting_text: string;
  notes: string;
  source: string;
  match_score: number | null;
  match_report: string | null;
  /** Name of the resume that produced match_score, so the ATS number reads as a fact about a document. */
  match_resume_name: string | null;
  /** Fitness check: 1-10 pursuit score. Distinct from match_score — see docs/FITNESS_CHECK_PLAN.md. */
  fitness_score: number | null;
  fitness_report: string | null;
  fitness_run_at: string | null;
  /** JSON StoredJobActivity — the job's activity banner, written via MCP or AI. See lib/job-activity.ts. */
  activity_summary: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  previous_status: string | null;
  is_starred: number;
}

export type JobInsert = Partial<Omit<JobRow, "id">>;
export type JobUpdate = Partial<Omit<JobRow, "id" | "created_at" | "user_id">>;

// libsql's Row is array-like (numeric indices + a `length` own property
// alongside the named columns), so casting it directly isn't a plain object —
// React's Server-to-Client serialization rejects it. Spreading strips those
// non-enumerable extras and leaves just the named fields.
function rowToJob(row: Row): JobRow {
  return { ...row } as unknown as JobRow;
}

export async function listJobs(userId: number | null, opts?: {
  sort?: string;
  order?: "asc" | "desc";
  status?: string;
  search?: string;
  starred?: boolean;
}): Promise<JobRow[]> {
  const db = await getDb();
  const allowedSorts: Record<string, string> = {
    company: "company COLLATE NOCASE",
    title: "title COLLATE NOCASE",
    status: "status",
    salary_min: "salary_min",
    salary_max: "salary_max",
    location: "location COLLATE NOCASE",
    match_score: "match_score",
    fitness_score: "fitness_score",
    created_at: "created_at",
    updated_at: "updated_at",
    applied_at: "applied_at",
  };
  const sortCol = allowedSorts[opts?.sort ?? ""] ?? "created_at";
  const order = opts?.order === "asc" ? "ASC" : "DESC";

  const owner = ownedBy(userId);
  const conditions: string[] = [owner.sql];
  const params: InValue[] = [...owner.args];

  if (opts?.status) {
    conditions.push("status = ?");
    params.push(opts.status);
  }
  if (opts?.search) {
    conditions.push("(company LIKE ? COLLATE NOCASE OR title LIKE ? COLLATE NOCASE OR location LIKE ? COLLATE NOCASE)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }

  if (opts?.starred) {
    conditions.push("is_starred = 1");
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const listCols = "id, user_id, company, title, url, location, remote_type, salary_min, salary_max, salary_text, status, previous_status, notes, source, match_score, match_resume_name, fitness_score, fitness_run_at, is_starred, created_at, updated_at, applied_at";
  const result = await db.execute({ sql: `SELECT ${listCols} FROM jobs ${where} ORDER BY ${sortCol} ${order}`, args: params });
  return result.rows.map(rowToJob);
}

/**
 * The one way to load a job by id, and so the ownership check: updateJob and
 * deleteJob take an id, so callers load through here first and pass job.id on.
 */
export async function getJob(id: number, userId: number | null): Promise<JobRow | undefined> {
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({ sql: `SELECT * FROM jobs WHERE id = ? AND ${owner.sql}`, args: [id, ...owner.args] });
  return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
}

function pacificNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "America/Los_Angeles" }).replace(",", "");
}

export async function createJob(data: JobInsert): Promise<JobRow> {
  const db = await getDb();
  if (!data.created_at) (data as Record<string, unknown>).created_at = pacificNow();
  if (!data.updated_at) (data as Record<string, unknown>).updated_at = pacificNow();
  const fields = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
  const values = fields.map((k) => (data as Record<string, unknown>)[k] as InValue);

  if (fields.length === 0) {
    const result = await db.execute("INSERT INTO jobs DEFAULT VALUES RETURNING *");
    return rowToJob(result.rows[0]);
  }

  const cols = fields.join(", ");
  const placeholders = fields.map(() => "?").join(", ");
  const result = await db.execute({ sql: `INSERT INTO jobs (${cols}) VALUES (${placeholders}) RETURNING *`, args: values });
  return rowToJob(result.rows[0]);
}

export async function updateJob(id: number, data: JobUpdate): Promise<JobRow | undefined> {
  const db = await getDb();
  const fields = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
  if (fields.length === 0) {
    const result = await db.execute({ sql: "SELECT * FROM jobs WHERE id = ?", args: [id] });
    return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
  }

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => (data as Record<string, unknown>)[k] as InValue);

  const result = await db.execute({ sql: `UPDATE jobs SET ${sets}, updated_at = datetime('now') WHERE id = ? RETURNING *`, args: [...values, id] });
  return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
}

export async function findMatchingJob(userId: number | null, data: { company?: string; title?: string; url?: string }): Promise<JobRow | undefined> {
  const db = await getDb();
  const owner = ownedBy(userId);

  if (data.url) {
    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE url != '' AND url = ? AND ${owner.sql}`,
      args: [data.url, ...owner.args],
    });
    if (result.rows[0]) return rowToJob(result.rows[0]);
  }
  if (data.company && data.title) {
    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE LOWER(company) = LOWER(?) AND LOWER(title) = LOWER(?) AND ${owner.sql}`,
      args: [data.company, data.title, ...owner.args],
    });
    if (result.rows[0]) return rowToJob(result.rows[0]);
  }
  return undefined;
}

export async function deleteJob(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({ sql: "DELETE FROM jobs WHERE id = ?", args: [id] });
  return result.rowsAffected > 0;
}

export async function claimUnownedJobs(userId: number): Promise<number> {
  const db = await getDb();
  const jobs = await db.execute({ sql: "UPDATE jobs SET user_id = ? WHERE user_id IS NULL", args: [userId] });
  await db.execute({ sql: "UPDATE resumes SET user_id = ? WHERE user_id IS NULL", args: [userId] });
  return jobs.rowsAffected;
}

/** Accept auto-closures as final: the jobs forget their prior status, so they're no longer offered for restore. */
export async function confirmClosedJobs(userId: number | null, ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({
    sql: `UPDATE jobs SET previous_status = NULL, updated_at = datetime('now') WHERE status = 'closed' AND id IN (${ids.map(() => "?").join(", ")}) AND ${owner.sql}`,
    args: [...ids, ...owner.args],
  });
  return result.rowsAffected;
}

/** Jobs auto-closed by the status check that still remember the status they left. */
export async function listRestorableJobs(userId: number | null): Promise<Pick<JobRow, "id" | "company" | "title" | "previous_status">[]> {
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({
    sql: `SELECT id, company, title, previous_status FROM jobs WHERE status = 'closed' AND previous_status IS NOT NULL AND previous_status != '' AND ${owner.sql}`,
    args: owner.args,
  });
  return result.rows.map((row) => ({ ...row }) as unknown as Pick<JobRow, "id" | "company" | "title" | "previous_status">);
}

export async function restoreClosedJobs(userId: number | null): Promise<{
  restoredCount: number;
  restoredJobs: { id: number; company: string; title: string; restoredTo: string }[];
}> {
  const db = await getDb();
  const candidates = await listRestorableJobs(userId);

  const restoredJobs: { id: number; company: string; title: string; restoredTo: string }[] = [];

  for (const row of candidates) {
    const id = Number(row.id);
    const restoredTo = String(row.previous_status);
    await db.execute({
      sql: "UPDATE jobs SET status = previous_status, previous_status = NULL, updated_at = datetime('now') WHERE id = ?",
      args: [id],
    });
    restoredJobs.push({
      id,
      company: String(row.company ?? ""),
      title: String(row.title ?? ""),
      restoredTo,
    });
  }

  return {
    restoredCount: restoredJobs.length,
    restoredJobs,
  };
}

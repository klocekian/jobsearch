import { getDb } from "./index";
import type { Row, InValue } from "@libsql/client";
import { looksLikeHtml } from "../html-text";

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
  /** analysis_runs.id of the current fitness / match report. See db/analysis-runs.ts. */
  fitness_run_id: number | null;
  match_run_id: number | null;
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

  const conditions: string[] = [];
  const params: InValue[] = [];

  if (userId != null) {
    conditions.push("user_id = ?");
    params.push(userId);
  } else {
    conditions.push("user_id IS NULL");
  }

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

export async function getJob(id: number, userId?: number | null): Promise<JobRow | undefined> {
  const db = await getDb();
  if (userId !== undefined) {
    const result = await db.execute({
      sql: userId != null ? "SELECT * FROM jobs WHERE id = ? AND user_id = ?" : "SELECT * FROM jobs WHERE id = ? AND user_id IS NULL",
      args: userId != null ? [id, userId] : [id],
    });
    return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
  }
  const result = await db.execute({ sql: "SELECT * FROM jobs WHERE id = ?", args: [id] });
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
  if (fields.length === 0) return getJob(id);

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => (data as Record<string, unknown>)[k] as InValue);

  const result = await db.execute({ sql: `UPDATE jobs SET ${sets}, updated_at = datetime('now') WHERE id = ? RETURNING *`, args: [...values, id] });
  return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
}

const TERMINAL_STATUSES = new Set(["rejected", "declined", "withdrawn", "abandoned", "closed"]);

/**
 * Fields that ride along with a status change: moving to "applied" stamps
 * applied_at (unless the caller supplied one), and moving into a terminal
 * status remembers the live status it left so the job can be restored later.
 */
export function statusChangeUpdates(
  next: string,
  currentStatus: string | undefined,
  opts?: { appliedAtGiven?: boolean },
): JobUpdate {
  const updates: JobUpdate = {};
  if (next === "applied" && !opts?.appliedAtGiven) {
    updates.applied_at = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  }
  if (TERMINAL_STATUSES.has(next)) {
    if (currentStatus && !TERMINAL_STATUSES.has(currentStatus)) updates.previous_status = currentStatus;
  } else {
    updates.previous_status = null;
  }
  return updates;
}

export async function findMatchingJob(userId: number | null, data: { company?: string; title?: string; url?: string }): Promise<JobRow | undefined> {
  const db = await getDb();
  const userClause = userId != null ? "user_id = ?" : "user_id IS NULL";
  const userArg = userId != null ? [userId] : [];

  if (data.url) {
    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE url != '' AND url = ? AND ${userClause}`,
      args: [data.url, ...userArg] as InValue[],
    });
    if (result.rows[0]) return rowToJob(result.rows[0]);
  }
  if (data.company && data.title) {
    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE LOWER(company) = LOWER(?) AND LOWER(title) = LOWER(?) AND ${userClause}`,
      args: [data.company, data.title, ...userArg] as InValue[],
    });
    if (result.rows[0]) return rowToJob(result.rows[0]);
  }
  return undefined;
}

export async function mergeJob(existing: JobRow, incoming: JobInsert): Promise<JobRow> {
  const updates: Record<string, unknown> = {};
  const mergeable: (keyof JobInsert)[] = [
    "location", "remote_type", "salary_text", "salary_min", "salary_max",
    "posting_text", "url",
  ];
  for (const key of mergeable) {
    const newVal = incoming[key];
    if (!newVal) continue;
    const oldVal = existing[key as keyof JobRow];

    // posting_text is judged on quality, not just length. Incoming text is
    // normalized on write, so a clean capture is usually SHORTER than a stored
    // one full of markup — under the longer-wins rule below, re-clipping could
    // never repair a job whose text came in as HTML.
    if (key === "posting_text" && typeof oldVal === "string" && looksLikeHtml(oldVal)) {
      updates[key] = newVal;
      continue;
    }
    if (!oldVal || (typeof oldVal === "string" && oldVal.length < (newVal as string).length)) {
      updates[key] = newVal;
    }
  }
  if (Object.keys(updates).length === 0) return existing;
  return (await updateJob(existing.id, updates))!;
}

export async function deleteJob(id: number): Promise<boolean> {
  const db = await getDb();
  // Foreign keys aren't enforced on every connection, so don't rely on the cascade.
  await db.execute({ sql: "DELETE FROM analysis_runs WHERE job_id = ?", args: [id] });
  const result = await db.execute({ sql: "DELETE FROM jobs WHERE id = ?", args: [id] });
  return result.rowsAffected > 0;
}

export async function claimUnownedJobs(userId: number): Promise<number> {
  const db = await getDb();
  const jobs = await db.execute({ sql: "UPDATE jobs SET user_id = ? WHERE user_id IS NULL", args: [userId] });
  await db.execute({ sql: "UPDATE resumes SET user_id = ? WHERE user_id IS NULL", args: [userId] });
  return jobs.rowsAffected;
}

export async function restoreClosedJobs(userId: number | null): Promise<{
  restoredCount: number;
  restoredJobs: { id: number; company: string; title: string; restoredTo: string }[];
}> {
  const db = await getDb();
  const userClause = userId != null ? "AND user_id = ?" : "";
  const userArgs: InValue[] = userId != null ? [userId] : [];

  const candidates = await db.execute({
    sql: `SELECT id, company, title, previous_status FROM jobs WHERE status = 'closed' AND previous_status IS NOT NULL AND previous_status != '' ${userClause}`,
    args: userArgs,
  });

  const restoredJobs: { id: number; company: string; title: string; restoredTo: string }[] = [];

  for (const row of candidates.rows) {
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

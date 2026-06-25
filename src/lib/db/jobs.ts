import { getDb } from "./index";

export interface JobRow {
  id: number;
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
  created_at: string;
  updated_at: string;
  applied_at: string | null;
}

export type JobInsert = Partial<Omit<JobRow, "id" | "created_at" | "updated_at">>;
export type JobUpdate = Partial<Omit<JobRow, "id" | "created_at">>;

export const JOB_STATUSES = [
  "saved",
  "applying",
  "applied",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "closed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function listJobs(opts?: {
  sort?: string;
  order?: "asc" | "desc";
  status?: string;
  search?: string;
}): JobRow[] {
  const db = getDb();
  const allowedSorts: Record<string, string> = {
    company: "company COLLATE NOCASE",
    title: "title COLLATE NOCASE",
    status: "status",
    salary_min: "salary_min",
    salary_max: "salary_max",
    location: "location COLLATE NOCASE",
    match_score: "match_score",
    created_at: "created_at",
    updated_at: "updated_at",
    applied_at: "applied_at",
  };
  const sortCol = allowedSorts[opts?.sort ?? ""] ?? "created_at";
  const order = opts?.order === "asc" ? "ASC" : "DESC";

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.status) {
    conditions.push("status = ?");
    params.push(opts.status);
  }
  if (opts?.search) {
    conditions.push("(company LIKE ? OR title LIKE ? OR posting_text LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM jobs ${where} ORDER BY ${sortCol} ${order}`).all(...params) as JobRow[];
}

export function getJob(id: number): JobRow | undefined {
  return getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
}

export function createJob(data: JobInsert): JobRow {
  const db = getDb();
  const fields = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
  const cols = fields.join(", ");
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((k) => (data as Record<string, unknown>)[k]);

  if (fields.length === 0) {
    const info = db.prepare("INSERT INTO jobs DEFAULT VALUES").run();
    return getJob(Number(info.lastInsertRowid))!;
  }

  const info = db.prepare(`INSERT INTO jobs (${cols}) VALUES (${placeholders})`).run(...values);
  return getJob(Number(info.lastInsertRowid))!;
}

export function updateJob(id: number, data: JobUpdate): JobRow | undefined {
  const db = getDb();
  const fields = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
  if (fields.length === 0) return getJob(id);

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => (data as Record<string, unknown>)[k]);

  db.prepare(`UPDATE jobs SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
  return getJob(id);
}

export function findMatchingJob(data: { company?: string; title?: string; url?: string }): JobRow | undefined {
  const db = getDb();
  if (data.url) {
    const byUrl = db.prepare("SELECT * FROM jobs WHERE url != '' AND url = ?").get(data.url) as JobRow | undefined;
    if (byUrl) return byUrl;
  }
  if (data.company && data.title) {
    return db.prepare(
      "SELECT * FROM jobs WHERE LOWER(company) = LOWER(?) AND LOWER(title) = LOWER(?)"
    ).get(data.company, data.title) as JobRow | undefined;
  }
  return undefined;
}

export function mergeJob(existing: JobRow, incoming: JobInsert): JobRow {
  const updates: Record<string, unknown> = {};
  const mergeable: (keyof JobInsert)[] = [
    "location", "remote_type", "salary_text", "salary_min", "salary_max",
    "posting_text", "url",
  ];
  for (const key of mergeable) {
    const newVal = incoming[key];
    if (!newVal) continue;
    const oldVal = existing[key as keyof JobRow];
    if (!oldVal || (typeof oldVal === "string" && oldVal.length < (newVal as string).length)) {
      updates[key] = newVal;
    }
  }
  if (Object.keys(updates).length === 0) return existing;
  return updateJob(existing.id, updates)!;
}

export function deleteJob(id: number): boolean {
  const result = getDb().prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return result.changes > 0;
}

export function jobStats(): { total: number; byStatus: Record<string, number> } {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as cnt FROM jobs").get() as { cnt: number }).cnt;
  const rows = db.prepare("SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status").all() as {
    status: string;
    cnt: number;
  }[];
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = r.cnt;
  return { total, byStatus };
}

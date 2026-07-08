import { getDb } from "./index";
import type { Row } from "@libsql/client";

export interface SubmissionRow {
  id: number;
  job_id: number;
  type: string;
  label: string;
  format: string;
  content: string;
  file_path: string | null;
  created_at: string;
}

// See rowToJob in jobs.ts for why the spread is needed — libsql's Row isn't
// actually a plain object (it carries hidden array-index own properties).
function rowToSub(row: Row): SubmissionRow {
  return { ...row } as unknown as SubmissionRow;
}

export async function listSubmissions(jobId: number): Promise<SubmissionRow[]> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM submissions WHERE job_id = ? ORDER BY created_at DESC", args: [jobId] });
  return result.rows.map(rowToSub);
}

export async function getSubmission(id: number): Promise<SubmissionRow | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM submissions WHERE id = ?", args: [id] });
  return result.rows[0] ? rowToSub(result.rows[0]) : undefined;
}

export async function createSubmission(data: {
  job_id: number;
  type: string;
  label: string;
  format: string;
  content: string;
  file_path?: string;
}): Promise<SubmissionRow> {
  const db = await getDb();
  const result = await db.execute({
    sql: "INSERT INTO submissions (job_id, type, label, format, content, file_path) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [data.job_id, data.type, data.label, data.format, data.content, data.file_path ?? null],
  });
  return rowToSub(result.rows[0]);
}

export async function deleteSubmission(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({ sql: "DELETE FROM submissions WHERE id = ?", args: [id] });
  return result.rowsAffected > 0;
}

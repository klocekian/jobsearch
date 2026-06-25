import { getDb } from "./index";

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

export function listSubmissions(jobId: number): SubmissionRow[] {
  return getDb().prepare("SELECT * FROM submissions WHERE job_id = ? ORDER BY created_at DESC").all(jobId) as SubmissionRow[];
}

export function getSubmission(id: number): SubmissionRow | undefined {
  return getDb().prepare("SELECT * FROM submissions WHERE id = ?").get(id) as SubmissionRow | undefined;
}

export function createSubmission(data: {
  job_id: number;
  type: string;
  label: string;
  format: string;
  content: string;
  file_path?: string;
}): SubmissionRow {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO submissions (job_id, type, label, format, content, file_path) VALUES (?, ?, ?, ?, ?, ?)")
    .run(data.job_id, data.type, data.label, data.format, data.content, data.file_path ?? null);
  return getSubmission(Number(info.lastInsertRowid))!;
}

export function deleteSubmission(id: number): boolean {
  return getDb().prepare("DELETE FROM submissions WHERE id = ?").run(id).changes > 0;
}

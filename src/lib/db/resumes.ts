import { getDb, ownedBy } from "./index";
import type { Row, InValue } from "@libsql/client";

export interface ResumeRow {
  id: number;
  name: string;
  content: string;
  file_name: string;
  is_default: number;
  tags: string;
  created_at: string;
  updated_at: string;
}

// See rowToJob in jobs.ts for why the spread is needed — libsql's Row isn't
// actually a plain object (it carries hidden array-index own properties).
function rowToResume(row: Row): ResumeRow {
  return { ...row } as unknown as ResumeRow;
}

export async function listResumes(userId: number | null): Promise<ResumeRow[]> {
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({ sql: `SELECT * FROM resumes WHERE ${owner.sql} ORDER BY is_default DESC, updated_at DESC`, args: owner.args });
  return result.rows.map(rowToResume);
}

export async function getResume(id: number, userId: number | null): Promise<ResumeRow | undefined> {
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({ sql: `SELECT * FROM resumes WHERE id = ? AND ${owner.sql}`, args: [id, ...owner.args] });
  return result.rows[0] ? rowToResume(result.rows[0]) : undefined;
}

/** The default resume, else the most recently updated one — listResumes' first row. */
export async function getDefaultResume(userId: number | null): Promise<ResumeRow | undefined> {
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({ sql: `SELECT * FROM resumes WHERE ${owner.sql} ORDER BY is_default DESC, updated_at DESC LIMIT 1`, args: owner.args });
  return result.rows[0] ? rowToResume(result.rows[0]) : undefined;
}

/** Only one resume per user is the default, so marking one clears the rest. */
async function clearDefault(userId: number | null): Promise<void> {
  const db = await getDb();
  const owner = ownedBy(userId);
  await db.execute({ sql: `UPDATE resumes SET is_default = 0 WHERE is_default = 1 AND ${owner.sql}`, args: owner.args });
}

export async function createResume(userId: number | null, data: {
  name: string;
  content: string;
  file_name?: string;
  is_default?: boolean;
  tags?: string[];
}): Promise<ResumeRow> {
  const db = await getDb();
  if (data.is_default) await clearDefault(userId);
  const result = await db.execute({
    sql: "INSERT INTO resumes (user_id, name, content, file_name, is_default, tags) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, data.name, data.content, data.file_name ?? "", data.is_default ? 1 : 0, JSON.stringify(data.tags ?? [])],
  });
  return rowToResume(result.rows[0]);
}

export async function addResumeTag(id: number, userId: number | null, tag: string): Promise<void> {
  const db = await getDb();
  const resume = await getResume(id, userId);
  if (!resume) return;
  const tags: string[] = JSON.parse(resume.tags || "[]");
  if (!tags.includes(tag)) {
    tags.push(tag);
    await db.execute({ sql: "UPDATE resumes SET tags = ? WHERE id = ?", args: [JSON.stringify(tags), id] });
  }
}

export async function updateResume(id: number, userId: number | null, data: {
  name?: string;
  content?: string;
  file_name?: string;
  is_default?: boolean;
}): Promise<ResumeRow | undefined> {
  const db = await getDb();
  const existing = await getResume(id, userId);
  if (!existing) return undefined;
  if (data.is_default) await clearDefault(userId);
  const fields: string[] = [];
  const values: InValue[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
  if (data.file_name !== undefined) { fields.push("file_name = ?"); values.push(data.file_name); }
  if (data.is_default !== undefined) { fields.push("is_default = ?"); values.push(data.is_default ? 1 : 0); }
  if (fields.length === 0) return existing;
  const result = await db.execute({
    sql: `UPDATE resumes SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ? RETURNING *`,
    args: [...values, id],
  });
  return result.rows[0] ? rowToResume(result.rows[0]) : undefined;
}

export async function deleteResume(id: number, userId: number | null): Promise<boolean> {
  const db = await getDb();
  const owner = ownedBy(userId);
  const result = await db.execute({ sql: `DELETE FROM resumes WHERE id = ? AND ${owner.sql}`, args: [id, ...owner.args] });
  return result.rowsAffected > 0;
}

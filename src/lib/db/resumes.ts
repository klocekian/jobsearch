import { getDb } from "./index";
import type { Row, InValue } from "@libsql/client";

export interface ResumeRow {
  id: number;
  name: string;
  content: string;
  file_name: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function rowToResume(row: Row): ResumeRow {
  return row as unknown as ResumeRow;
}

export async function listResumes(userId: number | null): Promise<ResumeRow[]> {
  const db = await getDb();
  const clause = userId != null ? "WHERE user_id = ?" : "WHERE user_id IS NULL";
  const args = userId != null ? [userId] : [];
  const result = await db.execute({ sql: `SELECT * FROM resumes ${clause} ORDER BY is_default DESC, updated_at DESC`, args });
  return result.rows.map(rowToResume);
}

export async function getResume(id: number): Promise<ResumeRow | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM resumes WHERE id = ?", args: [id] });
  return result.rows[0] ? rowToResume(result.rows[0]) : undefined;
}

export async function getDefaultResume(): Promise<ResumeRow | undefined> {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM resumes WHERE is_default = 1 LIMIT 1");
  if (result.rows[0]) return rowToResume(result.rows[0]);
  const fallback = await db.execute("SELECT * FROM resumes ORDER BY updated_at DESC LIMIT 1");
  return fallback.rows[0] ? rowToResume(fallback.rows[0]) : undefined;
}

export async function createResume(userId: number | null, data: {
  name: string;
  content: string;
  file_name?: string;
  is_default?: boolean;
}): Promise<ResumeRow> {
  const db = await getDb();
  if (data.is_default) {
    if (userId != null) {
      await db.execute({ sql: "UPDATE resumes SET is_default = 0 WHERE is_default = 1 AND user_id = ?", args: [userId] });
    } else {
      await db.execute("UPDATE resumes SET is_default = 0 WHERE is_default = 1 AND user_id IS NULL");
    }
  }
  const result = await db.execute({
    sql: "INSERT INTO resumes (user_id, name, content, file_name, is_default) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [userId, data.name, data.content, data.file_name ?? "", data.is_default ? 1 : 0],
  });
  return rowToResume(result.rows[0]);
}

export async function updateResume(id: number, data: {
  name?: string;
  content?: string;
  file_name?: string;
  is_default?: boolean;
}): Promise<ResumeRow | undefined> {
  const db = await getDb();
  if (data.is_default) {
    await db.execute("UPDATE resumes SET is_default = 0 WHERE is_default = 1");
  }
  const fields: string[] = [];
  const values: InValue[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
  if (data.file_name !== undefined) { fields.push("file_name = ?"); values.push(data.file_name); }
  if (data.is_default !== undefined) { fields.push("is_default = ?"); values.push(data.is_default ? 1 : 0); }
  if (fields.length === 0) return getResume(id);
  const result = await db.execute({
    sql: `UPDATE resumes SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ? RETURNING *`,
    args: [...values, id],
  });
  return result.rows[0] ? rowToResume(result.rows[0]) : undefined;
}

export async function deleteResume(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({ sql: "DELETE FROM resumes WHERE id = ?", args: [id] });
  return result.rowsAffected > 0;
}

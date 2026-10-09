import crypto from "node:crypto";
import { getDb } from "./index";
import type { Row } from "@libsql/client";

/**
 * Personal access tokens for the MCP endpoint — for scripts and clients that
 * can't do the OAuth sign-in. Only a SHA-256 of the token is stored, so the
 * plaintext is shown exactly once, at creation.
 */

export const API_TOKEN_PREFIX = "jbs_pat_";

export interface ApiTokenRow {
  id: number;
  user_id: number;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const COLUMNS = "id, user_id, label, created_at, last_used_at"; // never the hash

// See rowToJob in jobs.ts for why the spread is needed.
function rowToToken(row: Row): ApiTokenRow {
  return { ...row } as unknown as ApiTokenRow;
}

export async function createApiToken(userId: number, label: string): Promise<{ token: string; row: ApiTokenRow }> {
  const db = await getDb();
  const token = `${API_TOKEN_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  const result = await db.execute({
    sql: `INSERT INTO api_tokens (user_id, token_hash, label) VALUES (?, ?, ?) RETURNING ${COLUMNS}`,
    args: [userId, hashToken(token), label],
  });
  return { token, row: rowToToken(result.rows[0]) };
}

export async function listApiTokens(userId: number): Promise<ApiTokenRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT ${COLUMNS} FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    args: [userId],
  });
  return result.rows.map(rowToToken);
}

export async function revokeApiToken(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({ sql: "DELETE FROM api_tokens WHERE id = ? AND user_id = ?", args: [id, userId] });
  return result.rowsAffected > 0;
}

/** The owning user's id, or null. Stamps last_used_at as a side effect. */
export async function resolveApiToken(token: string): Promise<number | null> {
  if (!token.startsWith(API_TOKEN_PREFIX)) return null;
  const db = await getDb();
  const result = await db.execute({
    sql: "UPDATE api_tokens SET last_used_at = datetime('now') WHERE token_hash = ? RETURNING user_id",
    args: [hashToken(token)],
  });
  return result.rows[0] ? Number(result.rows[0].user_id) : null;
}

import { getDb } from "./index";
import type { Row } from "@libsql/client";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  anthropic_token: string | null;
  refresh_token: string | null;
  token_expires: number | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: Row): UserRow {
  return row as unknown as UserRow;
}

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return result.rows[0] ? rowToUser(result.rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  return result.rows[0] ? rowToUser(result.rows[0]) : undefined;
}

export async function upsertUser(data: {
  email: string;
  name: string;
  anthropic_token?: string;
  refresh_token?: string;
  token_expires?: number;
}): Promise<UserRow> {
  const db = await getDb();
  const existing = await getUserByEmail(data.email);
  if (existing) {
    await db.execute({
      sql: `UPDATE users SET name = ?, anthropic_token = COALESCE(?, anthropic_token),
            refresh_token = COALESCE(?, refresh_token), token_expires = COALESCE(?, token_expires),
            updated_at = datetime('now') WHERE id = ?`,
      args: [data.name, data.anthropic_token ?? null, data.refresh_token ?? null, data.token_expires ?? null, existing.id],
    });
    return (await getUserById(existing.id))!;
  }
  const result = await db.execute({
    sql: "INSERT INTO users (email, name, anthropic_token, refresh_token, token_expires) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [data.email, data.name, data.anthropic_token ?? null, data.refresh_token ?? null, data.token_expires ?? null],
  });
  return rowToUser(result.rows[0]);
}

export async function updateUserTokens(id: number, tokens: {
  anthropic_token: string;
  refresh_token?: string;
  token_expires?: number;
}): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE users SET anthropic_token = ?, refresh_token = COALESCE(?, refresh_token),
          token_expires = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [tokens.anthropic_token, tokens.refresh_token ?? null, tokens.token_expires ?? null, id],
  });
}

import { getDb, plainRow } from "./index";
import type { Row } from "@libsql/client";

export type AIProviderId = "claude" | "gemini" | "grok" | "mistral";

export interface UserAIProviderRow {
  id: number;
  user_id: number;
  provider: AIProviderId;
  api_key: string;
  model: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const rowToAIProvider = (row: Row) => plainRow<UserAIProviderRow>(row);

export async function getUserAIProviders(userId: number): Promise<UserAIProviderRow[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM user_ai_providers WHERE user_id = ? ORDER BY provider ASC",
    args: [userId],
  });
  return res.rows.map(rowToAIProvider);
}

export async function upsertUserAIProvider(data: {
  userId: number;
  provider: AIProviderId;
  apiKey: string;
  model?: string | null;
  isActive?: boolean;
}): Promise<UserAIProviderRow> {
  const db = await getDb();
  const existingList = await getUserAIProviders(data.userId);
  const isFirst = existingList.length === 0;
  const shouldBeActive = data.isActive ?? (isFirst ? true : false);

  if (shouldBeActive) {
    // Deactivate all others first
    await db.execute({
      sql: "UPDATE user_ai_providers SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?",
      args: [data.userId],
    });
  }

  await db.execute({
    sql: `INSERT INTO user_ai_providers (user_id, provider, api_key, model, is_active, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, provider) DO UPDATE SET
            api_key = excluded.api_key,
            model = COALESCE(excluded.model, user_ai_providers.model),
            is_active = CASE WHEN ? = 1 THEN 1 ELSE user_ai_providers.is_active END,
            updated_at = datetime('now')`,
    args: [
      data.userId,
      data.provider,
      data.apiKey,
      data.model ?? null,
      shouldBeActive ? 1 : 0,
      shouldBeActive ? 1 : 0,
    ],
  });

  const res = await db.execute({
    sql: "SELECT * FROM user_ai_providers WHERE user_id = ? AND provider = ?",
    args: [data.userId, data.provider],
  });
  return rowToAIProvider(res.rows[0]);
}

export async function setActiveAIProvider(userId: number, provider: AIProviderId): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE user_ai_providers SET is_active = CASE WHEN provider = ? THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE user_id = ?",
    args: [provider, userId],
  });
}

export async function deleteUserAIProvider(userId: number, provider: AIProviderId): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM user_ai_providers WHERE user_id = ? AND provider = ?",
    args: [userId, provider],
  });

  // If the deleted provider was active, make another one active if available
  const remaining = await getUserAIProviders(userId);
  if (remaining.length > 0 && !remaining.some((p) => p.is_active === 1)) {
    await setActiveAIProvider(userId, remaining[0].provider);
  }
}

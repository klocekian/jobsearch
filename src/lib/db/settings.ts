import { getDb } from "./index";

/** App-wide key/value settings — e.g. the refreshed server Claude token. */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return (result.rows[0]?.value as string) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')",
    args: [key, value, value],
  });
}

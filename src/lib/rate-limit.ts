import { getDb } from "./db";

// Per-user hourly allowances, counted in the database because each Vercel
// instance has its own memory. Two buckets:
//  - ai: calls to an AI provider (enforced in lib/ai, so every caller is covered)
//  - fetch: outside URLs fetched for the user (posting fetches, posting checks,
//    sheet imports). A bulk posting check costs one per job it checks.
// Limits can be overridden per deployment, e.g. RATE_LIMIT_AI_PER_HOUR=120.

export type RateBucket = "ai" | "fetch";

const DEFAULT_PER_HOUR: Record<RateBucket, number> = { ai: 60, fetch: 200 };
const WINDOW_SECONDS = 3600;

function perHour(bucket: RateBucket): number {
  const override = Number(process.env[`RATE_LIMIT_${bucket.toUpperCase()}_PER_HOUR`]);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_PER_HOUR[bucket];
}

/** The user's allowance for a bucket is used up for this hour. The message is safe to show. */
export class RateLimitError extends Error {
  constructor(
    readonly bucket: RateBucket,
    readonly retryAfterSeconds: number,
  ) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    const what = bucket === "ai" ? "AI requests" : "page fetches";
    super(`You've reached the hourly limit for ${what}. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
    this.name = "RateLimitError";
  }
}

/**
 * Spend `cost` from the user's allowance for `bucket`, or throw RateLimitError.
 * No user (the local stdio MCP server) means no limit.
 */
export async function spend(userId: number | null, bucket: RateBucket, cost = 1): Promise<void> {
  if (userId == null || cost <= 0) return;
  const now = Math.floor(Date.now() / 1000);
  const window = now - (now % WINDOW_SECONDS);
  const db = await getDb();
  const [, counted] = await db.batch(
    [
      // Earlier windows are never read again.
      { sql: "DELETE FROM rate_limits WHERE user_id = ? AND bucket = ? AND window_start < ?", args: [userId, bucket, window] },
      {
        sql: `INSERT INTO rate_limits (user_id, bucket, window_start, count) VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id, bucket, window_start) DO UPDATE SET count = count + excluded.count
              RETURNING count`,
        args: [userId, bucket, window, cost],
      },
    ],
    "write",
  );
  if (Number(counted.rows[0].count) > perHour(bucket)) {
    throw new RateLimitError(bucket, window + WINDOW_SECONDS - now);
  }
}

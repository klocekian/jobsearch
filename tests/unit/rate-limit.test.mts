// The hourly counter: costs add up, the limit is per user and bucket, and the
// local stdio MCP server (no user) is never limited.

import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.TURSO_DATABASE_URL = `file:${path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jobsearch-rl-")), "test.db")}`;
process.env.RATE_LIMIT_FETCH_PER_HOUR = "10";

const { spend, RateLimitError } = await import("@/lib/rate-limit");

it("adds up costs per user and bucket until the allowance runs out", async () => {
  await spend(1, "fetch", 6);
  await spend(1, "fetch", 4); // exactly 10: still allowed
  await assert.rejects(spend(1, "fetch"), RateLimitError);
  await spend(2, "fetch", 10); // another user
  await spend(1, "ai"); // another bucket
  await spend(null, "fetch", 1000); // no user, no limit
});

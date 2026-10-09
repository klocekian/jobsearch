// stdio entry point for the jobsearch MCP server: `pnpm mcp`.
//
// Database: the same one the app uses — TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
// if set, otherwise the local data/jobsearch.db. Point JOBSEARCH_ENV_FILE at an
// env file (e.g. .env.prod) to load those from there.
//
// User: JOBSEARCH_USER_EMAIL picks whose jobs to serve. Without it, a database
// with exactly one user serves that user, and one with no users serves the
// unowned (pre-login) data, matching the app's own fallback.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// stdout is the protocol channel; anything else written there corrupts it.
console.log = console.error;
console.info = console.error;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(repoRoot); // the default file: DB path is relative to the repo

const envFile = process.env.JOBSEARCH_ENV_FILE;
if (envFile) {
  const resolved = path.resolve(repoRoot, envFile);
  if (!fs.existsSync(resolved)) {
    console.error(`[jobsearch-mcp] JOBSEARCH_ENV_FILE not found: ${resolved}`);
    process.exit(1);
  }
  process.loadEnvFile(resolved);
}

// Imported after the env is loaded: the DB client reads it on first use.
const { getDb } = await import("@/lib/db");
const { getUserByEmail } = await import("@/lib/db/users");
const { createJobsearchMcpServer } = await import("./server");

async function resolveUserId(): Promise<number | null> {
  const email = process.env.JOBSEARCH_USER_EMAIL?.trim();
  if (email) {
    const user = await getUserByEmail(email);
    if (!user) throw new Error(`No user with email ${email} in this database.`);
    return user.id;
  }
  const db = await getDb();
  const users = await db.execute("SELECT id, email FROM users ORDER BY id");
  if (users.rows.length === 0) return null;
  if (users.rows.length === 1) return Number(users.rows[0].id);
  const emails = users.rows.map((r) => r.email).join(", ");
  throw new Error(`This database has several users (${emails}). Set JOBSEARCH_USER_EMAIL to choose one.`);
}

try {
  const userId = await resolveUserId();
  const server = createJobsearchMcpServer(userId);
  await server.connect(new StdioServerTransport());
  const db = process.env.TURSO_DATABASE_URL || "file:data/jobsearch.db";
  console.error(`[jobsearch-mcp] ready (db: ${db}, user: ${userId ?? "unowned"})`);
} catch (err) {
  console.error(`[jobsearch-mcp] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

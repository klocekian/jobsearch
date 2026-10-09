// Starts the built app (`next start`, so run `pnpm build` first) on a free
// port against a throwaway SQLite file, and gives tests a signed-in fetch.

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";

const SESSION_SECRET = "test-session-secret";
const AI_KEYS = [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_REFRESH_TOKEN",
  "GEMINI_API_KEY", "GROK_API_KEY", "XAI_API_KEY", "MISTRAL_API_KEY", "SERVER_AI_EMAILS",
];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** The session cookie the app would set for this user id. */
export function sessionCookie(userId) {
  const id = String(userId);
  return `jbs_session=${id}.${crypto.createHmac("sha256", SESSION_SECRET).update(id).digest("base64url")}`;
}

/**
 * @param {{ env?: Record<string, string> }} [opts] extra server env (AI keys are cleared unless given here)
 */
export async function startApp(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsearch-test-"));
  const dbFile = path.join(dir, "test.db");
  const port = await freePort();
  const env = { ...process.env, TURSO_DATABASE_URL: `file:${dbFile}`, SESSION_SECRET, PORT: String(port) };
  for (const k of AI_KEYS) delete env[k];
  Object.assign(env, opts.env);

  // Its own process group, so stop() takes down next's workers too.
  const child = spawn(path.resolve("node_modules/.bin/next"), ["start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode != null) throw new Error(`next start exited early:\n${output}`);
    try {
      if ((await fetch(`${base}/login`)).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`next start didn't come up:\n${output}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  // The schema is created on the first request that touches the database.
  await fetch(`${base}/api/jobs`, { headers: { Cookie: sessionCookie(1) } });
  const db = createClient({ url: `file:${dbFile}` });

  /** fetch as `as` (a user id), or signed out when `as` is null; JSON in, JSON out when possible. */
  async function req(method, urlPath, { as = 1, body, headers = {} } = {}) {
    const res = await fetch(base + urlPath, {
      method,
      headers: { "Content-Type": "application/json", ...(as != null ? { Cookie: sessionCookie(as) } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text, headers: res.headers };
  }

  async function addUsers(...users) {
    for (const u of users) {
      await db.execute({ sql: "INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)", args: [u.id, u.email, u.name ?? u.email] });
    }
  }

  async function stop() {
    if (child.exitCode == null) {
      const exited = new Promise((r) => child.once("exit", r));
      process.kill(-child.pid, "SIGTERM");
      await exited;
    }
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { base, db, req, addUsers, stop, output: () => output };
}

import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "./auth";
import { updateUserTokens } from "./db/users";
import type { UserRow } from "./db/users";
import { getDb } from "./db/index";

const CLIENT_ID = "41077d10-94b8-4194-be48-d251e9eb21b4";
const TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";

async function refreshOAuthToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return (result.rows[0]?.value as string) ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')",
    args: [key, value, value],
  });
}

async function getGlobalToken(): Promise<string | null> {
  // 1. Check env var (set at deploy time)
  const envToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;

  // 2. Check if we have a cached refreshed token in the DB
  const cached = await getSetting("anthropic_access_token").catch(() => null);
  const cachedExpiry = await getSetting("anthropic_token_expires").catch(() => null);

  if (cached && cachedExpiry) {
    const expiresAt = Number(cachedExpiry);
    const now = Math.floor(Date.now() / 1000);
    if (now < expiresAt - 60) {
      return cached;
    }
  }

  // 3. Try to refresh using ANTHROPIC_REFRESH_TOKEN env var
  const refreshToken = process.env.ANTHROPIC_REFRESH_TOKEN;
  if (refreshToken) {
    const tokens = await refreshOAuthToken(refreshToken);
    if (tokens) {
      await setSetting("anthropic_access_token", tokens.access_token);
      if (tokens.expires_in) {
        await setSetting("anthropic_token_expires", String(Math.floor(Date.now() / 1000) + tokens.expires_in));
      }
      return tokens.access_token;
    }
  }

  return envToken || null;
}

/**
 * Refreshes a per-user OAuth token if it's expired (or about to expire) and a
 * refresh token is available, persisting the refreshed token. Returns the
 * token to use right now.
 */
async function freshUserToken(user: UserRow): Promise<string | null> {
  if (!user.anthropic_token) return null;
  if (!user.token_expires) return user.anthropic_token; // manual API key — no expiry to track
  const now = Math.floor(Date.now() / 1000);
  if (now < user.token_expires - 60) return user.anthropic_token;
  if (!user.refresh_token) return null; // expired, can't refresh
  const tokens = await refreshOAuthToken(user.refresh_token);
  if (!tokens) return null;
  await updateUserTokens(user.id, {
    anthropic_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
  });
  return tokens.access_token;
}

export type ClaudeStatus = "connected" | "expired" | "none";

// Per-process cache for live token checks — avoids re-validating against the
// Anthropic API on every page load. Not shared across server instances, but
// each hit is a free/cheap call, so a stale cache just means an occasional
// extra check, never a wrong long-term status.
const liveTokenCache = new Map<string, { valid: boolean; checkedAt: number }>();
const LIVE_CHECK_TTL_MS = 5 * 60 * 1000;

/** Confirms a token actually works by making a free, read-only API call. */
async function isTokenLive(token: string): Promise<boolean> {
  const cached = liveTokenCache.get(token);
  if (cached && Date.now() - cached.checkedAt < LIVE_CHECK_TTL_MS) return cached.valid;
  let valid: boolean;
  try {
    const client = token.startsWith("sk-ant-oat")
      ? new Anthropic({ authToken: token, apiKey: undefined })
      : new Anthropic({ apiKey: token });
    await client.models.list({ limit: 1 });
    valid = true;
  } catch {
    valid = false;
  }
  liveTokenCache.set(token, { valid, checkedAt: Date.now() });
  return valid;
}

/**
 * The user-visible Claude connection state. Tokens with a tracked expiry use
 * the fast local check (refreshing if needed). Tokens without one — e.g. a
 * CLI-pasted OAuth access token, which carries no refresh info — can't be
 * judged from stored data alone, so we confirm they still work with a live,
 * cached API call rather than assuming "present" means "connected".
 */
export async function getUserClaudeStatus(user: UserRow | null): Promise<ClaudeStatus> {
  if (!user?.anthropic_token) return "none";
  if (user.token_expires) {
    const token = await freshUserToken(user);
    return token ? "connected" : "expired";
  }
  const live = await isTokenLive(user.anthropic_token);
  return live ? "connected" : "expired";
}

export async function getAnthropicClient(): Promise<Anthropic> {
  // Per-user token takes priority
  const user = await getSession().catch(() => null);
  if (user?.anthropic_token) {
    const token = await freshUserToken(user);
    if (token) {
      if (token.startsWith("sk-ant-oat")) {
        return new Anthropic({ authToken: token, apiKey: undefined });
      }
      return new Anthropic({ apiKey: token });
    }
  }

  // Global token (auto-refreshed)
  const globalToken = await getGlobalToken();
  if (globalToken) {
    if (globalToken.startsWith("sk-ant-oat")) {
      return new Anthropic({ authToken: globalToken, apiKey: undefined });
    }
    return new Anthropic({ apiKey: globalToken });
  }

  return new Anthropic();
}

import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "./auth";
import { updateUserTokens } from "./db/users";
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

export async function getAnthropicClient(): Promise<Anthropic> {
  // Per-user token takes priority
  const user = await getSession().catch(() => null);
  if (user?.anthropic_token) {
    let token = user.anthropic_token;
    if (user.token_expires && user.refresh_token) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= user.token_expires - 60) {
        const tokens = await refreshOAuthToken(user.refresh_token);
        if (tokens) {
          await updateUserTokens(user.id, {
            anthropic_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
          });
          token = tokens.access_token;
        }
      }
    }
    if (token.startsWith("sk-ant-oat")) {
      return new Anthropic({ authToken: token, apiKey: undefined });
    }
    return new Anthropic({ apiKey: token });
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

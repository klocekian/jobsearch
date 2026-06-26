import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "./auth";
import { updateUserTokens } from "./db/users";

const CLIENT_ID = "41077d10-94b8-4194-be48-d251e9eb21b4";
const TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";

async function refreshToken(userId: number, refreshToken: string): Promise<string | null> {
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
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    await updateUserTokens(userId, {
      anthropic_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

export async function getAnthropicClient(): Promise<Anthropic> {
  const user = await getSession().catch(() => null);

  if (user?.anthropic_token) {
    let token = user.anthropic_token;

    // Auto-refresh if expired and we have a refresh token
    if (user.token_expires && user.refresh_token) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= user.token_expires - 60) {
        const refreshed = await refreshToken(user.id, user.refresh_token);
        if (refreshed) token = refreshed;
      }
    }

    if (token.startsWith("sk-ant-oat")) {
      return new Anthropic({ authToken: token, apiKey: undefined });
    }
    return new Anthropic({ apiKey: token });
  }

  return new Anthropic();
}

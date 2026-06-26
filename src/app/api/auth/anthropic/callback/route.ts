import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { updateUserTokens } from "@/lib/db/users";

export const runtime = "nodejs";

const CLIENT_ID = "41077d10-94b8-4194-be48-d251e9eb21b4";
const TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/profile?error=${encodeURIComponent(error)}`, url.origin));
  }

  const store = await cookies();
  const savedState = store.get("ant_oauth_state")?.value;
  const codeVerifier = store.get("ant_oauth_verifier")?.value;
  store.delete("ant_oauth_state");
  store.delete("ant_oauth_verifier");

  if (!code || !state || state !== savedState || !codeVerifier) {
    return NextResponse.redirect(new URL("/profile?error=invalid_state", url.origin));
  }

  const user = await getSession();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        redirect_uri: `${url.origin}/api/auth/anthropic/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Anthropic token exchange failed:", tokenRes.status, text);
      return NextResponse.redirect(new URL("/profile?error=anthropic_token_failed", url.origin));
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    await updateUserTokens(user.id, {
      anthropic_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
    });

    return NextResponse.redirect(new URL("/profile?claude=connected", url.origin));
  } catch (err) {
    console.error("Anthropic OAuth error:", err);
    return NextResponse.redirect(new URL("/profile?error=anthropic_auth_failed", url.origin));
  }
}

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const CLIENT_ID = "41077d10-94b8-4194-be48-d251e9eb21b4";
const AUTH_URL = "https://platform.claude.com/oauth/authorize";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const store = await cookies();
  store.set("ant_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });
  store.set("ant_oauth_verifier", codeVerifier, { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${origin}/api/auth/anthropic/callback`,
    response_type: "code",
    scope: "user:profile user:inference",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(`${AUTH_URL}?${params}`);
}

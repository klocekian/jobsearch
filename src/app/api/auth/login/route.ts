import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";

export async function GET(request: Request) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const state = crypto.randomBytes(16).toString("hex");

  const store = await cookies();
  store.set("oauth_state", state, { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

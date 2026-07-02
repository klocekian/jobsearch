import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { upsertUser } from "@/lib/db/users";
import { setSession } from "@/lib/auth";
import { claimUnownedJobs } from "@/lib/db/jobs";

export const runtime = "nodejs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/profile?error=${encodeURIComponent(error)}`, url.origin));
  }

  const store = await cookies();
  const savedState = store.get("oauth_state")?.value;
  store.delete("oauth_state");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/profile?error=invalid_state", url.origin));
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `${url.origin}/api/auth/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/profile?error=token_failed", url.origin));
    }

    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
    console.log("Google OAuth tokens received:", { hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token, expiresIn: tokens.expires_in });

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/profile?error=userinfo_failed", url.origin));
    }

    const profile = (await userRes.json()) as {
      email: string;
      name?: string;
      picture?: string;
    };

    const user = await upsertUser({
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0],
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expires: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
    });

    await setSession(user.id);

    // First user claims all existing unowned data
    const claimed = await claimUnownedJobs(user.id);
    if (claimed > 0) {
      console.log(`User ${user.email} claimed ${claimed} unowned jobs`);
    }

    return NextResponse.redirect(new URL("/jobs", url.origin));
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(new URL("/profile?error=auth_failed", url.origin));
  }
}

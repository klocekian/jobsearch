import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { issueAuthCode, parseAuthorizeRequest, publicOrigin, redirectWith } from "@/lib/mcp-oauth";

// GET: the client sends the browser here. Signed out → Google sign-in, then
// back here. Signed in → the consent page, which POSTs the decision back.
//
// The consent step is what stops a third-party page from silently minting a
// code for a signed-in user. The POST can't be forged cross-site: the session
// cookie is SameSite=Lax, so it isn't sent on a cross-site form POST.

export const runtime = "nodejs";

function badRequest(message: string) {
  return new Response(`Can't connect: ${message}`, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseAuthorizeRequest(url.searchParams);
  if (!parsed.ok) {
    if (parsed.fatal) return badRequest(parsed.error);
    return NextResponse.redirect(redirectWith(parsed.redirectUri, { error: parsed.error, state: parsed.state }));
  }

  const origin = publicOrigin(request);
  const query = url.searchParams.toString();
  if (!(await getSessionUserId())) {
    // Relative next, so the post-login redirect can't be pointed off-site.
    const next = `/api/oauth/authorize?${query}`;
    return NextResponse.redirect(`${origin}/api/auth/login?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}/oauth/consent?${query}`);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form) if (typeof v === "string") params.set(k, v);

  const parsed = parseAuthorizeRequest(params);
  if (!parsed.ok) {
    if (parsed.fatal) return badRequest(parsed.error);
    return NextResponse.redirect(redirectWith(parsed.redirectUri, { error: parsed.error, state: parsed.state }), 303);
  }
  const { req } = parsed;

  const userId = await getSessionUserId();
  if (!userId) return badRequest("you're signed out. Start the connection again from Claude.");

  if (params.get("decision") !== "allow") {
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: "access_denied", state: req.state }), 303);
  }
  const code = issueAuthCode(userId, req);
  return NextResponse.redirect(redirectWith(req.redirectUri, { code, state: req.state }), 303);
}

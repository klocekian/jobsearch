import { getUserById } from "@/lib/db/users";
import {
  CORS_HEADERS,
  corsPreflight,
  issueTokens,
  readAuthCode,
  readRefreshToken,
  verifyPkce,
} from "@/lib/mcp-oauth";

// Token endpoint: authorization_code (with PKCE) and refresh_token grants.
// Public clients only — no client secret; PKCE is the proof of possession.

export const runtime = "nodejs";

function oauthError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}

async function readParams(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
  }
  return new URLSearchParams(await request.text());
}

export async function POST(request: Request) {
  const params = await readParams(request);
  const clientId = params.get("client_id");

  let userId: number;
  let cid: string;
  let scope: string;

  switch (params.get("grant_type")) {
    case "authorization_code": {
      const code = readAuthCode(params.get("code") ?? "");
      if (!code) return oauthError("invalid_grant", "Authorization code is invalid or expired.");
      if (clientId && clientId !== code.cid) return oauthError("invalid_grant", "Code was issued to another client.");
      if (params.get("redirect_uri") !== code.ru) return oauthError("invalid_grant", "redirect_uri doesn't match.");
      if (!verifyPkce(params.get("code_verifier") ?? "", code.cc)) {
        return oauthError("invalid_grant", "PKCE verification failed.");
      }
      ({ sub: userId, cid, scope } = code);
      break;
    }
    case "refresh_token": {
      const refresh = readRefreshToken(params.get("refresh_token") ?? "");
      if (!refresh) return oauthError("invalid_grant", "Refresh token is invalid or expired.");
      if (clientId && clientId !== refresh.cid) return oauthError("invalid_grant", "Token was issued to another client.");
      const user = await getUserById(refresh.sub);
      if (!user || (user.mcp_oauth_epoch ?? 0) !== refresh.ep) {
        return oauthError("invalid_grant", "Access was revoked. Reconnect from your assistant.");
      }
      ({ sub: userId, cid, scope } = refresh);
      break;
    }
    default:
      return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  }

  const user = await getUserById(userId);
  if (!user) return oauthError("invalid_grant", "Account no longer exists.");
  return Response.json(issueTokens(user.id, cid, scope, user.mcp_oauth_epoch ?? 0), {
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

export const OPTIONS = corsPreflight;

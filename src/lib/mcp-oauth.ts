import crypto from "node:crypto";

/**
 * OAuth 2.1 for the MCP endpoint, the shape claude.ai custom connectors and
 * Claude Code expect: protected-resource metadata → authorization-server
 * metadata → dynamic client registration → authorization code + PKCE → bearer
 * access token, with refresh.
 *
 * Everything is stateless. Client ids, authorization codes, and access/refresh
 * tokens are HMAC-signed payloads, so no OAuth tables exist. Two things keep
 * that from being a free pass:
 *  - a client id carries its registered redirect URIs, so /authorize only
 *    sends codes back to where the client said it lives;
 *  - access and refresh tokens carry the user's mcp_oauth_epoch, so
 *    "Disconnect Claude" in settings revokes everything issued so far.
 */

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";
// Derived, so an MCP token can never verify as a session cookie or vice versa.
const KEY = crypto.createHmac("sha256", SECRET).update("jobsearch-mcp-oauth").digest();

export const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days
const AUTH_CODE_TTL = 5 * 60; // 5 minutes
export const MCP_SCOPE = "jobsearch";

type TokenKind = "client" | "code" | "access" | "refresh";

function b64(data: string | Buffer): string {
  return Buffer.from(data).toString("base64url");
}

function mac(kind: TokenKind, body: string): string {
  return crypto.createHmac("sha256", KEY).update(`${kind}.${body}`).digest("base64url");
}

function sign(kind: TokenKind, payload: object): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(kind, body)}`;
}

function verify<T>(kind: TokenKind, token: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(kind, body));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp?: number };
    if (payload.exp != null && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

const now = () => Math.floor(Date.now() / 1000);

// ── Origin ─────────────────────────────────────────────────────────────────

/**
 * The origin clients reached us on. Must be identical everywhere it appears
 * (issuer, resource, WWW-Authenticate, login bounce) or clients reject the
 * metadata. MCP_PUBLIC_ORIGIN pins it when a proxy hides the real host.
 */
export function publicOrigin(request: Request): string {
  const pinned = process.env.MCP_PUBLIC_ORIGIN?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  if (pinned) return pinned;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(request.url).origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const mcpResourceUrl = (origin: string) => `${origin}/api/mcp`;
export const protectedResourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource`;

/** Discovery and token endpoints are fetched cross-origin by browser-based clients. */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ── Clients (RFC 7591, stateless) ──────────────────────────────────────────

export interface OAuthClient {
  name: string;
  redirectUris: string[];
}

/** https anywhere, or http only on loopback (Claude Code's local callback). */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

export function issueClientId(client: OAuthClient): string {
  return sign("client", { n: client.name, r: client.redirectUris });
}

export function readClientId(clientId: string): OAuthClient | null {
  const p = verify<{ n: string; r: string[] }>("client", clientId);
  return p ? { name: p.n, redirectUris: p.r } : null;
}

// ── Authorization requests ─────────────────────────────────────────────────

export interface AuthorizeRequest {
  clientId: string;
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scope: string;
}

/**
 * Validate /authorize parameters. Errors that make the redirect URI itself
 * untrustworthy come back as `fatal` — those must be shown, never redirected.
 */
export function parseAuthorizeRequest(params: URLSearchParams):
  | { ok: true; req: AuthorizeRequest }
  | { ok: false; fatal: true; error: string }
  | { ok: false; fatal: false; error: string; redirectUri: string; state: string | null } {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state");
  const client = clientId ? readClientId(clientId) : null;
  if (!client) return { ok: false, fatal: true, error: "Unknown client. Remove the connector and add it again." };
  if (!client.redirectUris.includes(redirectUri)) {
    return { ok: false, fatal: true, error: "redirect_uri is not registered for this client." };
  }
  if (params.get("response_type") !== "code") {
    return { ok: false, fatal: false, error: "unsupported_response_type", redirectUri, state };
  }
  const codeChallenge = params.get("code_challenge") ?? "";
  if (!codeChallenge || params.get("code_challenge_method") !== "S256") {
    return { ok: false, fatal: false, error: "invalid_request", redirectUri, state };
  }
  return { ok: true, req: { clientId, client, redirectUri, codeChallenge, state, scope: params.get("scope") || MCP_SCOPE } };
}

export function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

// ── Codes and tokens ───────────────────────────────────────────────────────

interface CodePayload { sub: number; cid: string; ru: string; cc: string; scope: string; exp: number }
interface TokenPayload { sub: number; cid: string; scope: string; ep: number; exp: number }

export function issueAuthCode(userId: number, req: AuthorizeRequest): string {
  return sign("code", {
    sub: userId, cid: req.clientId, ru: req.redirectUri, cc: req.codeChallenge, scope: req.scope,
    exp: now() + AUTH_CODE_TTL,
  } satisfies CodePayload);
}

export function readAuthCode(code: string): CodePayload | null {
  return verify<CodePayload>("code", code);
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(crypto.createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
}

export function issueTokens(userId: number, clientId: string, scope: string, epoch: number) {
  const base = { sub: userId, cid: clientId, scope, ep: epoch };
  return {
    access_token: sign("access", { ...base, exp: now() + ACCESS_TOKEN_TTL } satisfies TokenPayload),
    refresh_token: sign("refresh", { ...base, exp: now() + REFRESH_TOKEN_TTL } satisfies TokenPayload),
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    scope,
  };
}

/** Signature and expiry only — the caller still checks the epoch against the user row. */
export function readAccessToken(token: string): TokenPayload | null {
  return verify<TokenPayload>("access", token);
}

export function readRefreshToken(token: string): TokenPayload | null {
  return verify<TokenPayload>("refresh", token);
}

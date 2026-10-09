const DEV_SECRET = "dev-secret-change-in-production";

/**
 * The key session cookies and MCP OAuth tokens are signed with. Read lazily so
 * `next build` doesn't need it, but a production server without one refuses to
 * sign anything — the dev fallback is public, so anyone could forge a session.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set. Sessions can't be signed safely without it.");
  }
  return DEV_SECRET;
}

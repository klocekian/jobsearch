import { CORS_HEADERS, corsPreflight, publicOrigin, MCP_SCOPE } from "@/lib/mcp-oauth";

// RFC 8414 authorization-server metadata. issuer must equal the origin in the
// protected-resource metadata exactly, so both come from publicOrigin().

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = publicOrigin(request);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [MCP_SCOPE],
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } },
  );
}

export const OPTIONS = corsPreflight;

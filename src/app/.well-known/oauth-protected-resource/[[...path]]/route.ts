import { CORS_HEADERS, corsPreflight, mcpResourceUrl, publicOrigin, MCP_SCOPE } from "@/lib/mcp-oauth";

// RFC 9728 protected-resource metadata. The optional catch-all also answers the
// path-suffixed form (/.well-known/oauth-protected-resource/api/mcp) some clients try first.

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = publicOrigin(request);
  return Response.json(
    {
      resource: mcpResourceUrl(origin),
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: [MCP_SCOPE],
      resource_name: "Job Search",
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } },
  );
}

export const OPTIONS = corsPreflight;

import { CORS_HEADERS, corsPreflight, isAllowedRedirectUri, issueClientId } from "@/lib/mcp-oauth";

// RFC 7591 dynamic client registration. Nothing is stored: the client id is a
// signed record of the client's name and redirect URIs, which /authorize
// checks every request against.

export const runtime = "nodejs";

function error(description: string) {
  return Response.json(
    { error: "invalid_client_metadata", error_description: description },
    { status: 400, headers: CORS_HEADERS },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return error("Body must be JSON.");

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10) {
    return error("redirect_uris must be a non-empty array.");
  }
  if (!redirectUris.every((u) => typeof u === "string" && u.length <= 2000 && isAllowedRedirectUri(u))) {
    return error("redirect_uris must be https, or http on localhost.");
  }
  const name = typeof body.client_name === "string" && body.client_name.trim()
    ? body.client_name.trim().slice(0, 100)
    : new URL(redirectUris[0] as string).hostname;

  const clientId = issueClientId({ name, redirectUris: redirectUris as string[] });
  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS_HEADERS },
  );
}

export const OPTIONS = corsPreflight;

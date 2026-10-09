import { after } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getUserById, touchMcpUse } from "@/lib/db/users";
import { API_TOKEN_PREFIX, resolveApiToken } from "@/lib/db/api-tokens";
import { protectedResourceMetadataUrl, publicOrigin, readAccessToken } from "@/lib/mcp-oauth";
import { createJobsearchMcpServer } from "./server";

// Streamable HTTP transport for the deployed app. Stateless: every POST gets a
// fresh server scoped to the caller, and responses come back as plain JSON —
// nothing has to outlive a serverless invocation.

/** The user behind a bearer token: an OAuth access token, or a personal access token. */
async function authenticate(token: string): Promise<number | null> {
  if (token.startsWith(API_TOKEN_PREFIX)) return resolveApiToken(token);
  const claims = readAccessToken(token);
  if (!claims) return null;
  const user = await getUserById(claims.sub);
  if (!user || (user.mcp_oauth_epoch ?? 0) !== claims.ep) return null;
  after(() => touchMcpUse(user.id).catch(() => {}));
  return user.id;
}

/** 401 with the pointer that starts a client's OAuth discovery. */
function unauthorized(origin: string, hadToken: boolean): Response {
  const params = [
    hadToken && `error="invalid_token"`,
    `resource_metadata="${protectedResourceMetadataUrl(origin)}"`,
  ].filter(Boolean).join(", ");
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
    { status: 401, headers: { "WWW-Authenticate": `Bearer ${params}` } },
  );
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const origin = publicOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const userId = token ? await authenticate(token) : null;
  if (userId == null) return unauthorized(origin, !!token);

  const server = createJobsearchMcpServer(userId, {
    title: "Job Search",
    websiteUrl: origin,
    icons: [{ src: `${origin}/icon.png`, mimeType: "image/png" }],
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

/** No server-initiated stream in stateless mode; the spec's answer for GET/DELETE is 405. */
export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

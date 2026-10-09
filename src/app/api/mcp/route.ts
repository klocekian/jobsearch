import { handleMcpRequest, methodNotAllowed } from "@/mcp/http";

// The MCP endpoint. Clients authenticate with an OAuth access token (claude.ai
// connectors, Claude Code) or a personal access token from Profile → AI.

export const runtime = "nodejs";
// check_job_status fetches the posting; give it the same room as /api/jobs/check-status.
export const maxDuration = 120;

export const POST = handleMcpRequest;
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { bumpMcpOauthEpoch } from "@/lib/db/users";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/db/api-tokens";
import { mcpResourceUrl, publicOrigin } from "@/lib/mcp-oauth";

// Backs the "Connect Claude (MCP)" card in Profile → AI: the connector URL,
// personal access tokens, and the switch that disconnects every OAuth client.

export const runtime = "nodejs";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_token"), label: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("revoke_token"), id: z.number().int() }),
  z.object({ action: z.literal("disconnect_clients") }),
]);

export async function GET(request: Request) {
  const user = await getSession().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    url: mcpResourceUrl(publicOrigin(request)),
    last_used_at: user.mcp_last_used_at ?? null,
    tokens: await listApiTokens(user.id),
  });
}

export async function POST(request: Request) {
  const user = await getSession().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  switch (body.action) {
    case "create_token": {
      const { token, row } = await createApiToken(user.id, body.label);
      return NextResponse.json({ token, row }, { status: 201 });
    }
    case "revoke_token": {
      const ok = await revokeApiToken(user.id, body.id);
      return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    case "disconnect_clients":
      await bumpMcpOauthEpoch(user.id);
      return NextResponse.json({ ok: true });
  }
}

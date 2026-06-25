import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { updateUserTokens } from "@/lib/db/users";

export const runtime = "nodejs";

const Schema = z.object({
  api_key: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const { api_key } = Schema.parse(body);

    await updateUserTokens(user.id, { anthropic_token: api_key });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

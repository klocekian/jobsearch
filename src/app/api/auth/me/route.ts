import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null });
  const hasGlobalToken = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      hasAnthropicToken: !!user.anthropic_token || hasGlobalToken,
    },
  });
}

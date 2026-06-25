import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  if (!user) {
    const hasGlobalKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    return NextResponse.json({ connected: hasGlobalKey, source: hasGlobalKey ? "global" : "none" });
  }
  return NextResponse.json({
    connected: !!user.anthropic_token,
    source: user.anthropic_token ? "user" : "none",
  });
}

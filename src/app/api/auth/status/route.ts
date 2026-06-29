import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ connected: false, source: "none" });
  }
  return NextResponse.json({
    connected: !!user.anthropic_token,
    source: user.anthropic_token ? "user" : "none",
  });
}

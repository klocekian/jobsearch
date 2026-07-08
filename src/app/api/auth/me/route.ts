import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserClaudeStatus } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null });
  const claudeStatus = await getUserClaudeStatus(user);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      claudeStatus,
    },
  });
}

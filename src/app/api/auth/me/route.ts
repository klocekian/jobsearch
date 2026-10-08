import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserClaudeStatus } from "@/lib/anthropic";
import { getUserAIStatus } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null });
  const [claudeStatus, aiStatus] = await Promise.all([
    getUserClaudeStatus(user),
    getUserAIStatus(user.id),
  ]);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      claudeStatus,
      aiStatus,
    },
  });
}

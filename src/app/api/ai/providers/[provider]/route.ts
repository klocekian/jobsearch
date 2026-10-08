import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteUserAIProvider } from "@/lib/db/ai-providers";
import { type AIProviderId, AI_PROVIDERS } from "@/lib/ai";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await getSession().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  if (!provider || !AI_PROVIDERS[provider as AIProviderId]) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  await deleteUserAIProvider(user.id, provider as AIProviderId);
  return NextResponse.json({ success: true });
}

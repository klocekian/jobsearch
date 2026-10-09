import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { deleteUserAIProvider } from "@/lib/db/ai-providers";
import { type AIProviderId, AI_PROVIDERS } from "@/lib/ai";

type Params = { params: Promise<{ provider: string }> };

export const DELETE = withUser<Params>(async (_request, userId, { params }) => {
  const { provider } = await params;
  if (!provider || !AI_PROVIDERS[provider as AIProviderId]) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  await deleteUserAIProvider(userId, provider as AIProviderId);
  return NextResponse.json({ success: true });
});

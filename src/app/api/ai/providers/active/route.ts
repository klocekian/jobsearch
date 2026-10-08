import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setActiveAIProvider } from "@/lib/db/ai-providers";
import { type AIProviderId, AI_PROVIDERS } from "@/lib/ai";

export async function POST(request: Request) {
  const user = await getSession().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider } = body as { provider: AIProviderId };

    if (!provider || !AI_PROVIDERS[provider]) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    await setActiveAIProvider(user.id, provider);
    return NextResponse.json({ success: true, message: `Active provider set to ${AI_PROVIDERS[provider].name}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to set active provider";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

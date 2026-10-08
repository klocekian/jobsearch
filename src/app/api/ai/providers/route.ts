import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserAIProviders, upsertUserAIProvider } from "@/lib/db/ai-providers";
import { AI_PROVIDERS, type AIProviderId, testProviderKey } from "@/lib/ai";

export async function GET() {
  const user = await getSession().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stored = await getUserAIProviders(user.id);
  const storedMap = new Map(stored.map((p) => [p.provider, p]));

  // If user has legacy anthropic_token and no claude row yet, include it
  if (user.anthropic_token && !storedMap.has("claude")) {
    storedMap.set("claude", {
      id: 0,
      user_id: user.id,
      provider: "claude",
      api_key: user.anthropic_token,
      model: AI_PROVIDERS.claude.defaultModel,
      is_active: stored.length === 0 ? 1 : 0,
      created_at: "",
      updated_at: "",
    });
  }

  const providers = (Object.keys(AI_PROVIDERS) as AIProviderId[]).map((id) => {
    const meta = AI_PROVIDERS[id];
    const item = storedMap.get(id);
    const key = item?.api_key ?? "";
    const maskedKey = key
      ? key.length > 8
        ? `${key.slice(0, 4)}...${key.slice(-4)}`
        : "••••••••"
      : null;

    return {
      id,
      name: meta.name,
      badgeName: meta.badgeName,
      description: meta.description,
      defaultModel: meta.defaultModel,
      availableModels: meta.availableModels,
      helpUrl: meta.helpUrl,
      placeholder: meta.placeholder,
      isConfigured: !!key,
      isActive: item?.is_active === 1,
      model: item?.model || meta.defaultModel,
      maskedKey,
    };
  });

  return NextResponse.json({ providers });
}

export async function POST(request: Request) {
  const user = await getSession().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, apiKey, model, isActive } = body as {
      provider: AIProviderId;
      apiKey: string;
      model?: string;
      isActive?: boolean;
    };

    if (!provider || !AI_PROVIDERS[provider]) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const trimmedKey = apiKey.trim();

    // Verify key with provider API
    const isValid = await testProviderKey(provider, trimmedKey);
    if (!isValid) {
      return NextResponse.json(
        { error: `Could not validate ${AI_PROVIDERS[provider].name} key. Please check that the key is correct and active.` },
        { status: 400 },
      );
    }

    await upsertUserAIProvider({
      userId: user.id,
      provider,
      apiKey: trimmedKey,
      model: model || AI_PROVIDERS[provider].defaultModel,
      isActive,
    });

    return NextResponse.json({ success: true, message: `${AI_PROVIDERS[provider].name} connected successfully!` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save AI provider";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

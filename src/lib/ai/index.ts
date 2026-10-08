import { getSession } from "@/lib/auth";
import { getActiveAIProvider, getUserAIProviders } from "@/lib/db/ai-providers";
import type {
  AIProviderId,
  GenerateStructuredOptions,
  GenerateTextOptions,
  ResolvedAICredentials,
  StreamTextOptions,
} from "./types";
import { AI_PROVIDERS } from "./types";
import {
  generateClaudeStructured,
  generateClaudeText,
  streamClaudeText,
  testClaudeKey,
} from "./providers/claude";
import {
  generateGeminiStructured,
  generateGeminiText,
  streamGeminiText,
  testGeminiKey,
} from "./providers/gemini";
import {
  generateGrokStructured,
  generateGrokText,
  streamGrokText,
  testGrokKey,
} from "./providers/grok";
import {
  generateMistralStructured,
  generateMistralText,
  streamMistralText,
  testMistralKey,
} from "./providers/mistral";

export * from "./types";

export async function testProviderKey(provider: AIProviderId, apiKey: string): Promise<boolean> {
  switch (provider) {
    case "claude":
      return testClaudeKey(apiKey);
    case "gemini":
      return testGeminiKey(apiKey);
    case "grok":
      return testGrokKey(apiKey);
    case "mistral":
      return testMistralKey(apiKey);
    default:
      return false;
  }
}

export async function getActiveAICredentials(): Promise<ResolvedAICredentials> {
  const user = await getSession().catch(() => null);

  if (user) {
    // 1. Check user_ai_providers table for active provider
    const active = await getActiveAIProvider(user.id);
    if (active && active.api_key) {
      return {
        provider: active.provider,
        apiKey: active.api_key,
        model: active.model || AI_PROVIDERS[active.provider]?.defaultModel,
      };
    }

    // 2. Legacy fallback to users.anthropic_token
    if (user.anthropic_token) {
      return {
        provider: "claude",
        apiKey: user.anthropic_token,
        model: AI_PROVIDERS.claude.defaultModel,
      };
    }
  }

  // 3. Fallback to server environment variables
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return {
      provider: "claude",
      apiKey: (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)!,
      model: AI_PROVIDERS.claude.defaultModel,
    };
  }

  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: AI_PROVIDERS.gemini.defaultModel,
    };
  }

  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY) {
    return {
      provider: "grok",
      apiKey: (process.env.GROK_API_KEY || process.env.XAI_API_KEY)!,
      model: AI_PROVIDERS.grok.defaultModel,
    };
  }

  if (process.env.MISTRAL_API_KEY) {
    return {
      provider: "mistral",
      apiKey: process.env.MISTRAL_API_KEY,
      model: AI_PROVIDERS.mistral.defaultModel,
    };
  }

  throw new Error("No AI provider connected. Go to Profile > AI to connect Claude, Gemini, Grok, or Mistral.");
}

export async function generateText(options: GenerateTextOptions): Promise<{ text: string; model: string; provider: AIProviderId }> {
  const creds = await getActiveAICredentials();
  const mergedOptions = { ...options, model: options.model || creds.model || undefined };

  switch (creds.provider) {
    case "claude": {
      const res = await generateClaudeText(creds.apiKey, mergedOptions);
      return { ...res, provider: "claude" };
    }
    case "gemini": {
      const res = await generateGeminiText(creds.apiKey, mergedOptions);
      return { ...res, provider: "gemini" };
    }
    case "grok": {
      const res = await generateGrokText(creds.apiKey, mergedOptions);
      return { ...res, provider: "grok" };
    }
    case "mistral": {
      const res = await generateMistralText(creds.apiKey, mergedOptions);
      return { ...res, provider: "mistral" };
    }
  }
}

export async function streamText(options: StreamTextOptions): Promise<{ stream: ReadableStream<Uint8Array>; provider: AIProviderId; model: string }> {
  const creds = await getActiveAICredentials();
  const mergedOptions = { ...options, model: options.model || creds.model || undefined };
  const model = mergedOptions.model || AI_PROVIDERS[creds.provider].defaultModel;

  let stream: ReadableStream<Uint8Array>;
  switch (creds.provider) {
    case "claude":
      stream = streamClaudeText(creds.apiKey, mergedOptions);
      break;
    case "gemini":
      stream = streamGeminiText(creds.apiKey, mergedOptions);
      break;
    case "grok":
      stream = streamGrokText(creds.apiKey, mergedOptions);
      break;
    case "mistral":
      stream = streamMistralText(creds.apiKey, mergedOptions);
      break;
  }

  return { stream, provider: creds.provider, model };
}

export async function generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<{ data: T; model: string; provider: AIProviderId }> {
  const creds = await getActiveAICredentials();
  const mergedOptions = { ...options, model: options.model || creds.model || undefined };

  switch (creds.provider) {
    case "claude": {
      const res = await generateClaudeStructured(creds.apiKey, mergedOptions);
      return { ...res, provider: "claude" };
    }
    case "gemini": {
      const res = await generateGeminiStructured(creds.apiKey, mergedOptions);
      return { ...res, provider: "gemini" };
    }
    case "grok": {
      const res = await generateGrokStructured(creds.apiKey, mergedOptions);
      return { ...res, provider: "grok" };
    }
    case "mistral": {
      const res = await generateMistralStructured(creds.apiKey, mergedOptions);
      return { ...res, provider: "mistral" };
    }
  }
}

export interface UserAIStatus {
  connected: boolean;
  activeProvider: AIProviderId | null;
  providerName: string | null;
  configuredCount: number;
}

export async function getUserAIStatus(userId: number | null): Promise<UserAIStatus> {
  if (!userId) {
    return { connected: false, activeProvider: null, providerName: null, configuredCount: 0 };
  }

  const providers = await getUserAIProviders(userId);
  const active = providers.find((p) => p.is_active === 1) || providers[0] || null;

  if (active) {
    return {
      connected: true,
      activeProvider: active.provider,
      providerName: AI_PROVIDERS[active.provider]?.badgeName ?? active.provider,
      configuredCount: providers.length,
    };
  }

  return { connected: false, activeProvider: null, providerName: null, configuredCount: 0 };
}

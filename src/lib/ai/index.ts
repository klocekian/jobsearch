import { getUserAIProviders, type UserAIProviderRow } from "@/lib/db/ai-providers";
import { getUserById, type UserRow } from "@/lib/db/users";
import { freshUserToken, getGlobalToken } from "@/lib/anthropic";
import type {
  AIProviderId,
  GenerateStructuredOptions,
  GenerateTextOptions,
  ProviderAdapter,
  ResolvedAICredentials,
  StreamTextOptions,
} from "./types";
import { AI_PROVIDERS } from "./types";
import { AIError } from "./errors";
import { claudeAdapter } from "./providers/claude";
import { geminiAdapter } from "./providers/gemini";
import { grokAdapter, mistralAdapter } from "./providers/openai-compatible";

export * from "./types";
export { AIError, aiErrorStatus, type AIErrorKind } from "./errors";

const ADAPTERS: Record<AIProviderId, ProviderAdapter> = {
  claude: claudeAdapter,
  gemini: geminiAdapter,
  grok: grokAdapter,
  mistral: mistralAdapter,
};

export function testProviderKey(provider: AIProviderId, apiKey: string): Promise<boolean> {
  return ADAPTERS[provider]?.testKey(apiKey) ?? Promise.resolve(false);
}

/**
 * The user's connected providers, including a Claude token saved on the user
 * row before the providers table existed. That legacy entry has id 0 and is
 * active only when nothing else is configured.
 */
export async function listUserAIProviders(user: UserRow): Promise<UserAIProviderRow[]> {
  const stored = await getUserAIProviders(user.id);
  if (!user.anthropic_token || stored.some((p) => p.provider === "claude")) return stored;
  return [
    ...stored,
    {
      id: 0,
      user_id: user.id,
      provider: "claude",
      api_key: user.anthropic_token,
      model: AI_PROVIDERS.claude.defaultModel,
      is_active: stored.length === 0 ? 1 : 0,
      created_at: "",
      updated_at: "",
    },
  ];
}

function activeOf(providers: UserAIProviderRow[]): UserAIProviderRow | undefined {
  return providers.find((p) => p.is_active === 1) ?? providers[0];
}

/** A stored model the provider no longer offers (e.g. a retired Claude 3.x) falls back to the current default. */
export function supportedModel(provider: AIProviderId, model: string | null | undefined): string {
  const meta = AI_PROVIDERS[provider];
  return model && meta.availableModels.includes(model) ? model : meta.defaultModel;
}

/** Server keys, in order, for a user with nothing connected. */
async function serverCredentials(): Promise<ResolvedAICredentials | null> {
  const claude = (await getGlobalToken().catch(() => null)) || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  const keys: [AIProviderId, string | undefined][] = [
    ["claude", claude],
    ["gemini", process.env.GEMINI_API_KEY],
    ["grok", process.env.GROK_API_KEY || process.env.XAI_API_KEY],
    ["mistral", process.env.MISTRAL_API_KEY],
  ];
  const found = keys.find(([, key]) => key);
  return found ? { provider: found[0], apiKey: found[1]!, model: AI_PROVIDERS[found[0]].defaultModel } : null;
}

/** Which provider, key and model to use for this user: their active provider, else the server's keys. */
export async function resolveAICredentials(userId: number | null): Promise<ResolvedAICredentials> {
  const user = userId != null ? await getUserById(userId) : undefined;
  const active = user ? activeOf(await listUserAIProviders(user)) : undefined;
  if (active?.api_key) {
    // The legacy token may be an OAuth token that needs refreshing first.
    const apiKey = active.id === 0 ? (await freshUserToken(user!).catch(() => null)) || active.api_key : active.api_key;
    return { provider: active.provider, apiKey, model: supportedModel(active.provider, active.model) };
  }
  const server = await serverCredentials();
  if (server) return server;
  throw new AIError("no_provider", "No AI provider connected. Go to Profile > AI to connect Claude, Gemini, Grok, or Mistral.");
}

async function prepare<O extends GenerateTextOptions>(userId: number | null, options: O) {
  const creds = await resolveAICredentials(userId);
  return {
    adapter: ADAPTERS[creds.provider],
    creds,
    options: { ...options, model: options.model ? supportedModel(creds.provider, options.model) : creds.model },
  };
}

export async function streamText(
  userId: number | null,
  options: StreamTextOptions,
): Promise<{ stream: ReadableStream<Uint8Array>; provider: AIProviderId; model: string }> {
  const { adapter, creds, options: resolved } = await prepare(userId, options);
  return { stream: await adapter.streamText(creds.apiKey, resolved), provider: creds.provider, model: resolved.model };
}

export async function generateStructured<T>(
  userId: number | null,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string; provider: AIProviderId }> {
  const { adapter, creds, options: resolved } = await prepare(userId, options);
  return { ...(await adapter.generateStructured(creds.apiKey, resolved)), provider: creds.provider };
}

export interface UserAIStatus {
  connected: boolean;
  activeProvider: AIProviderId | null;
  providerName: string | null;
  configuredCount: number;
}

export async function getUserAIStatus(userId: number | null): Promise<UserAIStatus> {
  const user = userId != null ? await getUserById(userId) : undefined;
  const providers = user ? await listUserAIProviders(user) : [];
  const active = activeOf(providers);
  if (!active) return { connected: false, activeProvider: null, providerName: null, configuredCount: 0 };
  return {
    connected: true,
    activeProvider: active.provider,
    providerName: AI_PROVIDERS[active.provider]?.badgeName ?? active.provider,
    configuredCount: providers.length,
  };
}

import type { z } from "zod";

export type AIProviderId = "claude" | "gemini" | "grok" | "mistral";

export interface AIProviderMetadata {
  id: AIProviderId;
  name: string;
  badgeName: string;
  defaultModel: string;
  availableModels: string[];
  placeholder: string;
  helpUrl: string;
  description: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderMetadata> = {
  claude: {
    id: "claude",
    name: "Anthropic Claude",
    badgeName: "Claude",
    // The 3.x models listed here before were retired by Feb 2026 and now fail.
    defaultModel: "claude-opus-5",
    availableModels: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    placeholder: "sk-ant-api03-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    description: "Industry-leading reasoning, tailored cover letters, and deep resume match analysis.",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badgeName: "Gemini",
    // 2.0 and 1.5 are shut down (checked against Google's model list, Oct 2026).
    defaultModel: "gemini-3.8-flash",
    availableModels: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"],
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    description: "Fast, generous free tier, powerful multi-turn reasoning and parsing.",
  },
  grok: {
    id: "grok",
    name: "xAI Grok",
    badgeName: "Grok",
    // grok-2 and grok-beta are no longer in xAI's model list (Oct 2026).
    defaultModel: "grok-4.7",
    availableModels: ["grok-4.7", "grok-4.6", "grok-4.3"],
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    description: "Direct, concise writing and high-speed extraction.",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    badgeName: "Mistral",
    // The open-* models are retired. The -latest aliases follow each tier's
    // current release, so this list doesn't go stale the same way.
    defaultModel: "mistral-medium-latest",
    availableModels: ["mistral-medium-latest", "mistral-small-latest", "mistral-large-latest"],
    placeholder: "...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    description: "Efficient European open-weights intelligence and strong structured outputs.",
  },
};

export interface GenerateTextOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

export type StreamTextOptions = GenerateTextOptions;

export interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  schema: z.ZodType<T>;
  schemaName?: string;
  /**
   * Repair a raw JSON answer before validation — field aliases a model tends
   * to invent for this schema. Only runs for providers without native
   * structured output (Claude's answers already match the schema).
   */
  normalize?: (raw: unknown) => unknown;
}

export interface ResolvedAICredentials {
  provider: AIProviderId;
  apiKey: string;
  model: string;
}

/** What each provider implements. `options.model` is already resolved when these are called. */
export interface ProviderAdapter {
  testKey(apiKey: string): Promise<boolean>;
  streamText(apiKey: string, options: StreamTextOptions & { model: string }): Promise<ReadableStream<Uint8Array>>;
  generateStructured<T>(apiKey: string, options: GenerateStructuredOptions<T> & { model: string }): Promise<{ data: T; model: string }>;
}

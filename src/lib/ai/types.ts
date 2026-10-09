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
    defaultModel: "claude-3-7-sonnet-20250219",
    availableModels: ["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    placeholder: "sk-ant-api03-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    description: "Industry-leading reasoning, tailored cover letters, and deep resume match analysis.",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badgeName: "Gemini",
    defaultModel: "gemini-2.0-flash",
    availableModels: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    description: "Fast, generous free tier, powerful multi-turn reasoning and parsing.",
  },
  grok: {
    id: "grok",
    name: "xAI Grok",
    badgeName: "Grok",
    defaultModel: "grok-2-latest",
    availableModels: ["grok-2-latest", "grok-beta"],
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    description: "Direct, concise writing and high-speed extraction.",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    badgeName: "Mistral",
    defaultModel: "open-mistral-nemo",
    availableModels: ["open-mistral-nemo", "open-mistral-7b", "open-mixtral-8x7b", "mistral-small-latest", "mistral-large-latest", "codestral-latest"],
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

export interface StreamTextOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

export interface GenerateStructuredOptions<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName?: string;
  maxTokens?: number;
  model?: string;
}

export interface ResolvedAICredentials {
  provider: AIProviderId;
  apiKey: string;
  model?: string | null;
}

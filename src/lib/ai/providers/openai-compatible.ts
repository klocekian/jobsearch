import { AIError } from "../errors";
import { jsonInstructions, jsonSchemaOf, parseStructured, postJson, sseTextStream } from "../http";
import type { AIProviderId, GenerateTextOptions, ProviderAdapter } from "../types";

// xAI and Mistral both speak the OpenAI chat-completions protocol; they differ
// only in where they live and how hard they try to land an answer.

interface OpenAICompatibleConfig {
  id: AIProviderId;
  baseUrl: string;
  /**
   * Models to try, in order, when the chosen one can't serve the request —
   * unknown, not on the account's plan, or rate-limited.
   */
  fallbackModels?: string[];
  /** Ask for structured output through a forced function call first, then plain JSON mode. */
  structuredViaTools?: boolean;
}

type ChatMessage = { role: "system" | "user"; content: string };

const MAX_TOKENS_CAP = 8192;

function chat(system: string | undefined, prompt: string): ChatMessage[] {
  return system ? [{ role: "system", content: system }, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];
}

function maxTokens(options: GenerateTextOptions, fallback: number): number {
  return Math.min(options.maxTokens ?? fallback, MAX_TOKENS_CAP);
}

type Completion = { choices?: { message?: { content?: string; tool_calls?: { function?: { arguments?: string } }[] } }[] };

export function openAICompatible(config: OpenAICompatibleConfig): ProviderAdapter {
  const url = `${config.baseUrl}/chat/completions`;
  const auth = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}` });

  /** Run `attempt` with the chosen model, then each fallback, while failures are ones another model might not hit. */
  async function withFallbacks<R>(model: string, attempt: (model: string) => Promise<R>): Promise<R> {
    const models = Array.from(new Set([model, ...(config.fallbackModels ?? [])]));
    let lastError: unknown;
    for (const candidate of models) {
      try {
        return await attempt(candidate);
      } catch (err) {
        lastError = err;
        const retryable = err instanceof AIError && (err.kind === "rejected" || err.kind === "rate_limit" || err.kind === "bad_output");
        if (!retryable) throw err;
      }
    }
    throw lastError;
  }

  return {
    async testKey(apiKey) {
      try {
        return (await fetch(`${config.baseUrl}/models`, { headers: auth(apiKey) })).ok;
      } catch {
        return false;
      }
    },

    async streamText(apiKey, options) {
      const res = await withFallbacks(options.model, (model) =>
        postJson(config.id, url, {
          model,
          messages: chat(options.system, options.prompt),
          max_tokens: maxTokens(options, 4096),
          stream: true,
        }, auth(apiKey)),
      );
      return sseTextStream(res, (event) => (event as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content);
    },

    generateStructured(apiKey, options) {
      const system = (options.system ? options.system + "\n\n" : "") + jsonInstructions(options.schema);
      const base = { messages: chat(system, options.prompt), max_tokens: maxTokens(options, 8192) };
      const jsonSchema = config.structuredViaTools ? jsonSchemaOf(options.schema) : null;

      const viaJsonMode = async (model: string) => {
        const res = await postJson(config.id, url, { ...base, model, response_format: { type: "json_object" } }, auth(apiKey));
        const data = (await res.json()) as Completion;
        return { data: parseStructured(config.id, data.choices?.[0]?.message?.content ?? "{}", options), model };
      };

      const viaTool = async (model: string) => {
        const res = await postJson(config.id, url, {
          ...base,
          model,
          tools: [{
            type: "function",
            function: { name: options.schemaName || "submit_analysis", description: "Submit structured result", parameters: jsonSchema },
          }],
          tool_choice: "any",
        }, auth(apiKey));
        const message = ((await res.json()) as Completion).choices?.[0]?.message;
        const rawText = message?.tool_calls?.[0]?.function?.arguments ?? message?.content ?? "{}";
        return { data: parseStructured(config.id, rawText, options), model };
      };

      // JSON mode can rescue a model that won't do tool calls or botches the
      // arguments — not a bad key or an outage.
      const toolUnsupported = (err: unknown) => err instanceof AIError && (err.kind === "rejected" || err.kind === "bad_output");
      return withFallbacks(options.model, (model) =>
        jsonSchema
          ? viaTool(model).catch((err) => (toolUnsupported(err) ? viaJsonMode(model) : Promise.reject(err)))
          : viaJsonMode(model),
      );
    },
  };
}

export const grokAdapter = openAICompatible({ id: "grok", baseUrl: "https://api.x.ai/v1" });

export const mistralAdapter = openAICompatible({
  id: "mistral",
  baseUrl: "https://api.mistral.ai/v1",
  fallbackModels: ["mistral-medium-latest", "mistral-small-latest", "mistral-large-latest"],
  structuredViaTools: true,
});

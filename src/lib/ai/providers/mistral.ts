import type { GenerateStructuredOptions, GenerateTextOptions, StreamTextOptions } from "../types";
import { AI_PROVIDERS } from "../types";

const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";

export async function testMistralKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${MISTRAL_BASE_URL}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatMistralError(status: number, errText: string): string {
  try {
    const json = JSON.parse(errText);
    const msg = json.message || json.error?.message || errText;
    const code = json.code || json.error?.code;
    if (status === 429) {
      return `Mistral API rate limit exceeded (${code ? `code ${code}: ` : ""}${msg}). Please wait a few seconds or check your usage tier at console.mistral.ai.`;
    }
    return `Mistral API error (${status}): ${msg}`;
  } catch {
    if (status === 429) {
      return `Mistral API rate limit exceeded (429). Please wait a few seconds or check your account usage tier at console.mistral.ai.`;
    }
    return `Mistral API error (${status}): ${errText}`;
  }
}

async function fetchMistralWithRetry(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  maxRetries = 3,
): Promise<Response> {
  let lastRes: Response | null = null;
  let lastErrText = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: 2s, 4s
      const delay = 2000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return res;
      }

      lastRes = res;
      lastErrText = await res.text();

      // Only retry on 429 (rate limit) or 503 (service unavailable)
      if (res.status !== 429 && res.status !== 503) {
        throw new Error(formatMistralError(res.status, lastErrText));
      }
    } catch (err: unknown) {
      if (attempt === maxRetries - 1 || (err instanceof Error && !err.message.includes("429") && !err.message.includes("rate limit"))) {
        throw err;
      }
    }
  }

  throw new Error(formatMistralError(lastRes?.status ?? 429, lastErrText));
}

const FALLBACK_MODELS = [
  "open-mistral-nemo",
  "open-mistral-7b",
  "open-mixtral-8x7b",
  "mistral-small-latest",
  "mistral-large-latest",
];


export async function generateMistralText(
  apiKey: string,
  options: GenerateTextOptions,
): Promise<{ text: string; model: string }> {
  const initialModel = options.model || AI_PROVIDERS.mistral.defaultModel;
  const maxTokens = Math.min(options.maxTokens ?? 8192, 8192);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  const body = {
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const candidateModels = Array.from(new Set([initialModel, ...FALLBACK_MODELS]));
  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const res = await fetchMistralWithRetry(`${MISTRAL_BASE_URL}/chat/completions`, apiKey, { ...body, model });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      return { text, model };
    } catch (err: unknown) {
      lastError = err;
      // If error was rate limit, forbidden tier, or unsupported model, try next candidate
      if (
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("403") ||
          err.message.includes("404") ||
          err.message.includes("400") ||
          err.message.includes("rate limit") ||
          err.message.includes("subscription tier") ||
          err.message.includes("not available"))
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export async function streamMistralText(
  apiKey: string,
  options: StreamTextOptions,
): Promise<ReadableStream<Uint8Array>> {
  const initialModel = options.model || AI_PROVIDERS.mistral.defaultModel;
  const maxTokens = Math.min(options.maxTokens ?? 4096, 4096);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  const candidateModels = Array.from(new Set([initialModel, ...FALLBACK_MODELS]));
  let lastRes: Response | null = null;
  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const res = await fetchMistralWithRetry(`${MISTRAL_BASE_URL}/chat/completions`, apiKey, {
        model,
        messages,
        max_tokens: maxTokens,
        stream: true,
      });
      lastRes = res;
      break;
    } catch (err: unknown) {
      lastError = err;
      if (
        err instanceof Error &&
        (err.message.includes("404") ||
          err.message.includes("does not exist") ||
          err.message.includes("not available"))
      ) {
        continue;
      }
      throw err;
    }
  }

  if (!lastRes || !lastRes.body) {
    throw (lastError || new Error("Mistral stream response body is empty."));
  }

  const reader = lastRes.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {}
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

import { normalizeStructuredPayload, safeParseLlmJson } from "../normalize-structured";

export async function generateMistralStructured<T>(
  apiKey: string,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string }> {
  const initialModel = options.model || AI_PROVIDERS.mistral.defaultModel;
  const maxTokens = Math.min(options.maxTokens ?? 8192, 8192);

  const jsonSchema = typeof (options.schema as { toJSONSchema?: () => unknown }).toJSONSchema === "function"
    ? (options.schema as { toJSONSchema: () => unknown }).toJSONSchema()
    : null;

  const schemaInstruction = jsonSchema
    ? `\n\nREQUIRED JSON SCHEMA:\nYou MUST format your response as a valid JSON object strictly matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}\n`
    : "";

  const systemPrompt = (options.system ? options.system + "\n\n" : "") +
    `You MUST output valid JSON only. Respond exclusively with a valid JSON object matching the requested schema. Do not include markdown code blocks or preamble.${schemaInstruction}`;

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: options.prompt },
  ];

  const candidateModels = Array.from(new Set([initialModel, ...FALLBACK_MODELS]));
  let lastError: unknown;

  for (const model of candidateModels) {
    // Attempt 1: Try with native tool calling
    try {
      const toolBody = {
        model,
        messages,
        max_tokens: maxTokens,
        tools: jsonSchema
          ? [
              {
                type: "function",
                function: {
                  name: options.schemaName || "submit_analysis",
                  description: "Submit structured result",
                  parameters: jsonSchema,
                },
              },
            ]
          : undefined,
        tool_choice: jsonSchema ? "any" : undefined,
        response_format: jsonSchema ? undefined : { type: "json_object" },
      };

      const res = await fetchMistralWithRetry(`${MISTRAL_BASE_URL}/chat/completions`, apiKey, toolBody);
      const data = await res.json();
      const message = data.choices?.[0]?.message;

      let rawText = "{}";
      if (message?.tool_calls?.[0]?.function?.arguments) {
        rawText = message.tool_calls[0].function.arguments;
      } else if (message?.content) {
        rawText = message.content;
      }

      const parsedJson = safeParseLlmJson(rawText);
      const normalized = normalizeStructuredPayload(parsedJson, options.schemaName);
      const validated = options.schema.parse(normalized);
      return { data: validated, model };
    } catch (err: unknown) {
      // Attempt 2: Fallback to JSON mode if tool calling was unsupported
      try {
        const jsonBody = {
          model,
          messages,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        };
        const res = await fetchMistralWithRetry(`${MISTRAL_BASE_URL}/chat/completions`, apiKey, jsonBody);
        const data = await res.json();
        const rawText = data.choices?.[0]?.message?.content ?? "{}";
        const parsedJson = safeParseLlmJson(rawText);
        const normalized = normalizeStructuredPayload(parsedJson, options.schemaName);
        const validated = options.schema.parse(normalized);
        return { data: validated, model };
      } catch (innerErr: unknown) {
        lastError = innerErr || err;
      }

      if (
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("403") ||
          err.message.includes("404") ||
          err.message.includes("400") ||
          err.message.includes("rate limit") ||
          err.message.includes("subscription tier") ||
          err.message.includes("not available"))
      ) {
        continue;
      }
    }
  }

  throw lastError;
}

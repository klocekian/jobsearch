import type { GenerateStructuredOptions, GenerateTextOptions, StreamTextOptions } from "../types";
import { AI_PROVIDERS } from "../types";

const XAI_BASE_URL = "https://api.x.ai/v1";

export async function testGrokKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${XAI_BASE_URL}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatGrokError(status: number, errText: string): string {
  try {
    const json = JSON.parse(errText);
    const msg = json.error?.message || json.message || errText;
    if (status === 429) {
      return `xAI Grok rate limit exceeded. Please retry in a few seconds or check your console.x.ai account.`;
    }
    return `Grok API error (${status}): ${msg}`;
  } catch {
    if (status === 429) {
      return `xAI Grok rate limit exceeded. Please retry in a few seconds.`;
    }
    return `Grok API error (${status}): ${errText}`;
  }
}

async function fetchGrokWithRetry(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  maxRetries = 3,
): Promise<Response> {
  let lastRes: Response | null = null;
  let lastErrText = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 1500 * Math.pow(2, attempt - 1) + Math.random() * 300;
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

      if (res.status !== 429 && res.status !== 503) {
        throw new Error(formatGrokError(res.status, lastErrText));
      }
    } catch (err: unknown) {
      if (attempt === maxRetries - 1 || (err instanceof Error && !err.message.includes("rate limit"))) {
        throw err;
      }
    }
  }

  throw new Error(formatGrokError(lastRes?.status ?? 429, lastErrText));
}

export async function generateGrokText(
  apiKey: string,
  options: GenerateTextOptions,
): Promise<{ text: string; model: string }> {
  const model = options.model || AI_PROVIDERS.grok.defaultModel;

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  const res = await fetchGrokWithRetry(`${XAI_BASE_URL}/chat/completions`, apiKey, {
    model,
    messages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: 0.7,
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

export async function streamGrokText(
  apiKey: string,
  options: StreamTextOptions,
): Promise<ReadableStream<Uint8Array>> {
  const model = options.model || AI_PROVIDERS.grok.defaultModel;
  const maxTokens = Math.min(options.maxTokens ?? 4096, 4096);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  const res = await fetchGrokWithRetry(`${XAI_BASE_URL}/chat/completions`, apiKey, {
    model,
    messages,
    max_tokens: maxTokens,
    stream: true,
  });

  if (!res.body) {
    throw new Error("Grok response body is empty.");
  }

  const reader = res.body.getReader();
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

export async function generateGrokStructured<T>(
  apiKey: string,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string }> {
  const model = options.model || AI_PROVIDERS.grok.defaultModel;

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

  const res = await fetchGrokWithRetry(`${XAI_BASE_URL}/chat/completions`, apiKey, {
    model,
    messages,
    max_tokens: options.maxTokens ?? 8192,
    response_format: { type: "json_object" },
  });

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content ?? "{}";
  const parsedJson = safeParseLlmJson(rawText);
  const normalized = normalizeStructuredPayload(parsedJson, options.schemaName);
  const validated = options.schema.parse(normalized);
  return { data: validated, model };
}

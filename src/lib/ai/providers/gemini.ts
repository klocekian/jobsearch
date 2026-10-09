import type { GenerateStructuredOptions, GenerateTextOptions, StreamTextOptions } from "../types";
import { AI_PROVIDERS } from "../types";

export async function testGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatGeminiError(status: number, errText: string): string {
  try {
    const json = JSON.parse(errText);
    const msg = json.error?.message || json.message || errText;
    if (status === 429) {
      return `Google Gemini rate limit exceeded. Please retry in a few seconds or check your AI Studio quota.`;
    }
    return `Gemini API error (${status}): ${msg}`;
  } catch {
    if (status === 429) {
      return `Google Gemini rate limit exceeded. Please retry in a few seconds.`;
    }
    return `Gemini API error (${status}): ${errText}`;
  }
}

async function fetchGeminiWithRetry(
  url: string,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return res;
      }

      lastRes = res;
      lastErrText = await res.text();

      if (res.status !== 429 && res.status !== 503) {
        throw new Error(formatGeminiError(res.status, lastErrText));
      }
    } catch (err: unknown) {
      if (attempt === maxRetries - 1 || (err instanceof Error && !err.message.includes("rate limit"))) {
        throw err;
      }
    }
  }

  throw new Error(formatGeminiError(lastRes?.status ?? 429, lastErrText));
}

export async function generateGeminiText(
  apiKey: string,
  options: GenerateTextOptions,
): Promise<{ text: string; model: string }> {
  const model = options.model || AI_PROVIDERS.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (options.system) {
    contents.push({ role: "user", parts: [{ text: `System Instructions:\n${options.system}` }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
  }
  contents.push({ role: "user", parts: [{ text: options.prompt }] });

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  };

  const res = await fetchGeminiWithRetry(url, body);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text, model };
}

export async function streamGeminiText(
  apiKey: string,
  options: StreamTextOptions,
): Promise<ReadableStream<Uint8Array>> {
  const model = options.model || AI_PROVIDERS.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (options.system) {
    contents.push({ role: "user", parts: [{ text: `System Instructions:\n${options.system}` }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
  }
  contents.push({ role: "user", parts: [{ text: options.prompt }] });

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(options.maxTokens ?? 4096, 8192),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    throw new Error(formatGeminiError(res.status, err));
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
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
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

export async function generateGeminiStructured<T>(
  apiKey: string,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string }> {
  const model = options.model || AI_PROVIDERS.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const jsonSchema = typeof (options.schema as { toJSONSchema?: () => unknown }).toJSONSchema === "function"
    ? (options.schema as { toJSONSchema: () => unknown }).toJSONSchema()
    : null;

  const schemaInstruction = jsonSchema
    ? `\n\nREQUIRED JSON SCHEMA:\nYou MUST format your response as a valid JSON object strictly matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}\n`
    : "";

  const systemInstructions = (options.system ? options.system + "\n\n" : "") +
    `IMPORTANT: You MUST respond ONLY with a single raw, valid JSON object matching the required schema. Do not enclose in markdown code blocks. Do not add conversational text.${schemaInstruction}`;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: "user", parts: [{ text: systemInstructions }] },
    { role: "model", parts: [{ text: "Understood. I will respond with valid JSON matching the schema." }] },
    { role: "user", parts: [{ text: options.prompt }] },
  ];

  const body = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: options.maxTokens ?? 8192,
    },
  };

  const res = await fetchGeminiWithRetry(url, body);

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsedJson = safeParseLlmJson(rawText);
  const normalized = normalizeStructuredPayload(parsedJson, options.schemaName);
  const validated = options.schema.parse(normalized);
  return { data: validated, model };
}

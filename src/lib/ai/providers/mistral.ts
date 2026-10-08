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

export async function generateMistralText(
  apiKey: string,
  options: GenerateTextOptions,
): Promise<{ text: string; model: string }> {
  const model = options.model || AI_PROVIDERS.mistral.defaultModel;

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  const res = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

export function streamMistralText(
  apiKey: string,
  options: StreamTextOptions,
): ReadableStream<Uint8Array> {
  const model = options.model || AI_PROVIDERS.mistral.defaultModel;

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: options.maxTokens ?? 4096,
            stream: true,
          }),
        });

        if (!res.ok || !res.body) {
          const err = await res.text();
          throw new Error(`Mistral stream error (${res.status}): ${err}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
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

export async function generateMistralStructured<T>(
  apiKey: string,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string }> {
  const model = options.model || AI_PROVIDERS.mistral.defaultModel;

  const systemPrompt = (options.system ? options.system + "\n\n" : "") +
    "You MUST output valid JSON only. Respond exclusively with a valid JSON object matching the requested schema.";

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: options.prompt },
  ];

  const res = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral structured API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  let rawText = data.choices?.[0]?.message?.content ?? "{}";
  rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

  const parsedJson = JSON.parse(rawText);
  const validated = options.schema.parse(parsedJson);
  return { data: validated, model };
}

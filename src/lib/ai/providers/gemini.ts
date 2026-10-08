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

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text, model };
}

export function streamGeminiText(
  apiKey: string,
  options: StreamTextOptions,
): ReadableStream<Uint8Array> {
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
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  };

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          const err = await res.text();
          throw new Error(`Gemini Stream error (${res.status}): ${err}`);
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

export async function generateGeminiStructured<T>(
  apiKey: string,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string }> {
  const model = options.model || AI_PROVIDERS.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstructions = (options.system ? options.system + "\n\n" : "") +
    "IMPORTANT: You MUST respond ONLY with a single raw, valid JSON object matching the required schema. Do not enclose in markdown code blocks. Do not add conversational text.";

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: "user", parts: [{ text: systemInstructions }] },
    { role: "model", parts: [{ text: "Understood. I will respond with valid JSON only." }] },
    { role: "user", parts: [{ text: options.prompt }] },
  ];

  const body = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini structured API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

  const parsedJson = JSON.parse(rawText);
  const validated = options.schema.parse(parsedJson);
  return { data: validated, model };
}

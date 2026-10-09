import { jsonInstructions, parseStructured, postJson, sseTextStream } from "../http";
import type { GenerateTextOptions, ProviderAdapter } from "../types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type Content = { role: string; parts: { text: string }[] };

/** Gemini's v1beta has no system role here, so instructions go in as an acknowledged first turn. */
function conversation(system: string | undefined, prompt: string, ack: string): Content[] {
  const contents: Content[] = [];
  if (system) {
    contents.push({ role: "user", parts: [{ text: system }] });
    contents.push({ role: "model", parts: [{ text: ack }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });
  return contents;
}

function textOf(event: unknown): string | undefined {
  return (event as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.[0]?.text;
}

function textRequest(options: GenerateTextOptions) {
  return {
    contents: conversation(
      options.system && `System Instructions:\n${options.system}`,
      options.prompt,
      "Understood. I will follow these instructions.",
    ),
    generationConfig: { maxOutputTokens: Math.min(options.maxTokens ?? 4096, 8192) },
  };
}

export const geminiAdapter: ProviderAdapter = {
  async testKey(apiKey) {
    try {
      return (await fetch(`${BASE_URL}/models?key=${apiKey}`)).ok;
    } catch {
      return false;
    }
  },

  async streamText(apiKey, options) {
    const url = `${BASE_URL}/models/${options.model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const res = await postJson("gemini", url, textRequest(options));
    return sseTextStream(res, textOf);
  },

  async generateStructured(apiKey, options) {
    const url = `${BASE_URL}/models/${options.model}:generateContent?key=${apiKey}`;
    const system = (options.system ? options.system + "\n\n" : "") + `IMPORTANT: ${jsonInstructions(options.schema)}`;
    const res = await postJson("gemini", url, {
      contents: conversation(system, options.prompt, "Understood. I will respond with valid JSON matching the schema."),
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: options.maxTokens ?? 8192 },
    });
    const rawText = textOf(await res.json()) ?? "{}";
    return { data: parseStructured("gemini", rawText, options), model: options.model };
  },
};

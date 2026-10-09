import { z } from "zod";
import { AIError, aiErrorFromStatus, errorDetail } from "./errors";
import type { AIProviderId, GenerateStructuredOptions } from "./types";

// Plumbing for the providers called over plain HTTP (Gemini and the
// OpenAI-compatible ones). Claude goes through its SDK, which does its own
// retries and parses structured output natively.

/** POST JSON, retrying rate limits and outages with backoff. Failures throw AIError. */
export async function postJson(
  provider: AIProviderId,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  maxAttempts = 3,
): Promise<Response> {
  let lastError: AIError | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = 1500 * Math.pow(2, attempt - 1) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, delay));
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastError = new AIError("unavailable", `Couldn't reach ${provider}: ${(err as Error).message}`, provider, { cause: err });
      continue;
    }
    if (res.ok) return res;
    lastError = aiErrorFromStatus(provider, res.status, errorDetail(await res.text().catch(() => "")));
    if (lastError.kind !== "rate_limit" && res.status !== 503) throw lastError;
  }
  throw lastError!;
}

/** Turn a server-sent-events response into a stream of text, using `pick` to read each event's delta. */
export function sseTextStream(res: Response, pick: (event: unknown) => string | undefined): ReadableStream<Uint8Array> {
  if (!res.body) throw new AIError("bad_output", "The provider returned an empty stream.");
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
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const text = pick(JSON.parse(data));
              if (text) controller.enqueue(encoder.encode(text));
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

export function jsonSchemaOf(schema: z.ZodType): unknown {
  try {
    return z.toJSONSchema(schema);
  } catch {
    // Not every schema is representable (transforms, catch-alls); the model then works from the prompt alone.
    return null;
  }
}

/** System-prompt suffix for providers without native structured output: answer with JSON matching the schema. */
export function jsonInstructions(schema: z.ZodType): string {
  const jsonSchema = jsonSchemaOf(schema);
  const schemaBlock = jsonSchema
    ? `\n\nREQUIRED JSON SCHEMA:\nYou MUST format your response as a valid JSON object strictly matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}\n`
    : "";
  return `You MUST respond ONLY with a single raw, valid JSON object matching the required schema. Do not enclose it in markdown code blocks. Do not add conversational text.${schemaBlock}`;
}

/** Validate a model's JSON text against the caller's schema, repairing what can safely be repaired. */
export function parseStructured<T>(provider: AIProviderId, rawText: string, options: GenerateStructuredOptions<T>): T {
  let json: unknown;
  try {
    json = safeParseLlmJson(rawText);
  } catch (err) {
    throw new AIError("bad_output", `${provider} returned malformed JSON.`, provider, { cause: err });
  }
  let payload = unwrapEnvelope(json, options.schema, options.schemaName);
  if (options.normalize) payload = options.normalize(payload);
  const parsed = options.schema.safeParse(payload);
  if (!parsed.success) {
    throw new AIError("bad_output", `${provider}'s answer didn't match the expected shape: ${z.prettifyError(parsed.error)}`, provider);
  }
  return parsed.data;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Models without native structured output often nest the answer under a key —
 * `{"result": {...}}`, or the schema's own name. If the top level has none of
 * the schema's fields but a wrapper does, use the wrapper's contents.
 */
function unwrapEnvelope(raw: unknown, schema: z.ZodType, schemaName?: string): unknown {
  if (!isPlainObject(raw) || !(schema instanceof z.ZodObject)) return raw;
  const fields = Object.keys(schema.shape);
  const looksLikePayload = (obj: Record<string, unknown>) => fields.some((f) => f in obj);
  if (looksLikePayload(raw)) return raw;

  const names = schemaName
    ? [
        schemaName,
        schemaName.charAt(0).toLowerCase() + schemaName.slice(1),
        schemaName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(),
      ]
    : [];
  for (const key of [...names, "result", "data", "response", "output", "payload"]) {
    const inner = raw[key];
    if (isPlainObject(inner) && looksLikePayload(inner)) return inner;
  }
  const values = Object.values(raw);
  if (values.length === 1 && isPlainObject(values[0]) && looksLikePayload(values[0])) return values[0];
  return raw;
}

/** Parse JSON from a model, tolerating markdown fences and output cut off mid-object. */
export function safeParseLlmJson(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Close an unterminated string, then any brackets left open.
    let repaired = cleaned;
    let inQuote = false;
    for (let i = 0; i < repaired.length; i++) {
      if (repaired[i] === '"' && (i === 0 || repaired[i - 1] !== "\\")) inQuote = !inQuote;
    }
    if (inQuote) repaired += '"';

    const stack: string[] = [];
    for (const c of repaired) {
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if ((c === "}" || c === "]") && stack[stack.length - 1] === c) stack.pop();
    }
    while (stack.length > 0) repaired += stack.pop();

    try {
      return JSON.parse(repaired);
    } catch {
      throw firstErr;
    }
  }
}

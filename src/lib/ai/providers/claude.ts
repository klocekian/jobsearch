import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AIError, aiErrorFromStatus } from "../errors";
import type { ProviderAdapter } from "../types";

/** OAuth access tokens (sk-ant-oat…) authenticate as bearer tokens; everything else is an API key. */
export function anthropicClient(key: string, opts?: { timeout?: number }): Anthropic {
  return key.startsWith("sk-ant-oat")
    ? new Anthropic({ authToken: key, apiKey: undefined, ...opts })
    : new Anthropic({ apiKey: key, ...opts });
}

export async function testClaudeKey(apiKey: string, timeout?: number): Promise<boolean> {
  try {
    await anthropicClient(apiKey, timeout ? { timeout } : undefined).models.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

// Current Claude models think by default, and thinking draws on max_tokens —
// budgets sized for the old models would leave too little room for the answer.
const MIN_MAX_TOKENS = 16_000;

function toAIError(err: unknown): unknown {
  // APIConnectionError extends APIError in the TS SDK, so it's checked first.
  if (err instanceof Anthropic.APIConnectionError) {
    return new AIError("unavailable", "Couldn't reach Anthropic. Try again shortly.", "claude", { cause: err });
  }
  if (err instanceof Anthropic.APIError) {
    return aiErrorFromStatus("claude", err.status ?? 502, err.message);
  }
  return err;
}

function unusable(stopReason: string | null): AIError {
  if (stopReason === "refusal") return new AIError("rejected", "Claude declined this request.", "claude");
  if (stopReason === "max_tokens") return new AIError("bad_output", "Claude ran out of room before finishing.", "claude");
  return new AIError("bad_output", `Claude did not return structured output (stop_reason=${stopReason}).`, "claude");
}

export const claudeAdapter: ProviderAdapter = {
  testKey: (apiKey) => testClaudeKey(apiKey),

  async streamText(apiKey, options) {
    const rawStream = anthropicClient(apiKey).messages.stream({
      model: options.model,
      max_tokens: Math.max(options.maxTokens ?? 0, MIN_MAX_TOKENS),
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
    });

    // Wait for the first event so an auth or rate-limit failure surfaces as an
    // error response, not as a 200 stream that dies immediately.
    const iterator = rawStream[Symbol.asyncIterator]();
    let firstEvent: IteratorResult<Anthropic.MessageStreamEvent, unknown>;
    try {
      firstEvent = await iterator.next();
    } catch (err) {
      throw toAIError(err);
    }

    const encoder = new TextEncoder();
    const emit = (controller: ReadableStreamDefaultController<Uint8Array>, ev: Anthropic.MessageStreamEvent) => {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        controller.enqueue(encoder.encode(ev.delta.text));
      }
    };
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (!firstEvent.done && firstEvent.value) emit(controller, firstEvent.value);
          for await (const event of rawStream) emit(controller, event);
          controller.close();
        } catch (err) {
          controller.error(toAIError(err));
        }
      },
    });
  },

  async generateStructured(apiKey, options) {
    try {
      const parsed = await anthropicClient(apiKey).messages.parse({
        model: options.model,
        max_tokens: Math.max(options.maxTokens ?? 0, MIN_MAX_TOKENS),
        system: options.system,
        messages: [{ role: "user", content: options.prompt }],
        output_config: { format: zodOutputFormat(options.schema) },
      });
      if (!parsed.parsed_output) throw unusable(parsed.stop_reason);
      return { data: parsed.parsed_output, model: options.model };
    } catch (err) {
      throw toAIError(err);
    }
  },
};

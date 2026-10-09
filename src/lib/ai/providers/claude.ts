import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { GenerateStructuredOptions, GenerateTextOptions, StreamTextOptions } from "../types";
import { AI_PROVIDERS } from "../types";

function getClient(apiKey: string): Anthropic {
  if (apiKey.startsWith("sk-ant-oat")) {
    return new Anthropic({ authToken: apiKey, apiKey: undefined });
  }
  return new Anthropic({ apiKey });
}

export async function testClaudeKey(apiKey: string): Promise<boolean> {
  try {
    const client = getClient(apiKey);
    await client.models.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function generateClaudeText(
  apiKey: string,
  options: GenerateTextOptions,
): Promise<{ text: string; model: string }> {
  const client = getClient(apiKey);
  const model = options.model || AI_PROVIDERS.claude.defaultModel;
  const res = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
  });

  const textBlock = res.content.find((c) => c.type === "text");
  return { text: textBlock ? textBlock.text : "", model };
}

export async function streamClaudeText(
  apiKey: string,
  options: StreamTextOptions,
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient(apiKey);
  const model = options.model || AI_PROVIDERS.claude.defaultModel;
  const maxTokens = Math.min(options.maxTokens ?? 4096, 8192);

  const rawStream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
  });

  const iterator = rawStream[Symbol.asyncIterator]();
  let firstEvent: IteratorResult<Anthropic.MessageStreamEvent, unknown>;
  try {
    firstEvent = await iterator.next();
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        throw new Error("Anthropic Claude authentication failed. Please check your API key in Profile > AI.");
      }
      if (err.status === 429) {
        throw new Error("Anthropic Claude rate limit exceeded. Please wait a moment and try again.");
      }
      throw new Error(`Claude API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!firstEvent.done && firstEvent.value) {
          const ev = firstEvent.value;
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        for await (const event of rawStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

export async function generateClaudeStructured<T>(
  apiKey: string,
  options: GenerateStructuredOptions<T>,
): Promise<{ data: T; model: string }> {
  const client = getClient(apiKey);
  const model = options.model || AI_PROVIDERS.claude.defaultModel;

  try {
    const parsed = await client.messages.parse({
      model,
      max_tokens: options.maxTokens ?? 4096,
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
      output_config: { format: zodOutputFormat(options.schema) },
    });

    if (!parsed.parsed_output) {
      throw new Error(`Claude did not return structured output (stop_reason=${parsed.stop_reason})`);
    }

    return { data: parsed.parsed_output, model };
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        throw new Error("Anthropic Claude rate limit exceeded. Please wait a moment and try again.");
      }
      throw new Error(`Claude API error (${err.status}): ${err.message}`);
    }
    throw err;
  }
}

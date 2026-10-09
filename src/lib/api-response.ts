import { NextResponse } from "next/server";
import { z } from "zod";
import { AIError, aiErrorStatus } from "@/lib/ai";

/** Parse a JSON body against a schema; on failure, the 400 to send back instead. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: never } | { data?: never; error: NextResponse }> {
  try {
    return { data: schema.parse(await request.json()) };
  } catch (err: unknown) {
    const message = err instanceof z.ZodError ? z.prettifyError(err) : "Invalid request body.";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }
}

/** The response for a failed AI call: the message, its kind as `code`, and a status that fits. */
export function aiErrorResponse(err: unknown, fallback: string): NextResponse {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof AIError ? err.kind : undefined;
  return NextResponse.json({ error: message, code }, { status: aiErrorStatus(err) });
}

/** A streamed plain-text body, uncached and untransformed so chunks reach the browser as they arrive. */
export function textStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

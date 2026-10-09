import { AI_PROVIDERS, type AIProviderId } from "./types";

/**
 * - no_provider: nothing connected and no server key to fall back on
 * - auth: the provider rejected the key
 * - rate_limit: the provider is throttling this key
 * - unavailable: the provider is down or unreachable
 * - rejected: the provider refused the request (bad model, plan limits, input)
 * - bad_output: a response came back but couldn't be used
 */
export type AIErrorKind = "no_provider" | "auth" | "rate_limit" | "unavailable" | "rejected" | "bad_output";

/** A failed AI call, classified so callers can react without reading the message. */
export class AIError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly provider?: AIProviderId,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AIError";
  }
}

/** Classify a provider's HTTP error. `detail` is its own explanation, kept for the cases that need it. */
export function aiErrorFromStatus(provider: AIProviderId, status: number, detail: string): AIError {
  const name = AI_PROVIDERS[provider].name;
  if (status === 401) return new AIError("auth", `${name} rejected the API key. Check it in Profile > AI.`, provider);
  if (status === 429) return new AIError("rate_limit", `${name} rate limit exceeded. Wait a moment and try again.`, provider);
  if (status >= 500) return new AIError("unavailable", `${name} is unavailable right now (${status}). Try again shortly.`, provider);
  return new AIError("rejected", `${name} API error (${status}): ${detail}`, provider);
}

/** The provider's own message from an error body, which is usually JSON. */
export function errorDetail(body: string): string {
  try {
    const json = JSON.parse(body);
    return json.error?.message || json.message || body;
  } catch {
    return body;
  }
}

/**
 * The status an API route should answer with. Our own 401 means "not signed
 * in", so a provider rejecting its key is a 502 like any other upstream failure.
 */
export function aiErrorStatus(err: unknown): number {
  if (!(err instanceof AIError)) return 502;
  switch (err.kind) {
    case "no_provider":
      return 409;
    case "rate_limit":
      return 429;
    case "unavailable":
      return 503;
    default:
      return 502;
  }
}

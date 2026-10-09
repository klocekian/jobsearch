// Browser-side helpers for calling this app's own /api routes. Every route
// answers failures with `{ error: string }` and a non-2xx status; these turn
// that into a thrown ApiError so callers can't silently ignore a failed write.

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status}).`;
  const text = await res.text().catch(() => "");
  try {
    const d = JSON.parse(text) as { error?: unknown };
    if (typeof d?.error === "string" && d.error) message = d.error;
  } catch {
    // Not JSON — a plain-text error from a streaming route is still worth
    // showing, but an HTML error page is not.
    if (text && !text.trimStart().startsWith("<")) message = text;
  }
  return new ApiError(message, res.status);
}

/** fetch() that throws ApiError on a non-2xx status. Returns the raw response (for streams). */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) throw await errorFrom(res);
  return res;
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return json<T>(await apiFetch(url, init));
}

/** Send a JSON body (or FormData as-is, or nothing) and parse the JSON reply. */
export async function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return json<T>(await apiFetch(url, init));
}

/**
 * Read a text/plain streaming response to the end, calling onText with the
 * full text so far after every chunk. Resolves to the complete text.
 */
export async function readTextStream(res: Response, onText: (soFar: string) => void): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream received.");
  const decoder = new TextDecoder();
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onText(accumulated);
  }
  return accumulated;
}

/**
 * A user-facing message for anything a request can throw. fetch() reports a
 * network failure as a TypeError ("Failed to fetch"), which reads worse than
 * the caller's fallback.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError || !(err instanceof Error) || !err.message) return fallback;
  return err.message;
}

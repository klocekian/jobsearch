import { lookup } from "node:dns/promises";
import net from "node:net";

// Fetching URLs that users hand us: job postings, careers pages, shared sheets.
// Every hop must resolve to a public address — the first URL and each redirect
// it leads to — so a public link can't bounce the server onto its own network
// or a cloud metadata endpoint.

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_REDIRECTS = 5;

/** A URL we won't fetch. The message is safe to show the user. */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** True for loopback / private / link-local / unspecified addresses. */
function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0 || p[0] === 127 || p[0] === 10) return true; // unspecified, loopback, private
    if (p[0] === 192 && p[1] === 168) return true; // private
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // private
    if (p[0] === 169 && p[1] === 254) return true; // link-local (incl. cloud metadata)
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    if (lower.startsWith("fe80")) return true; // link-local
    // IPv4-mapped (::ffff:a.b.c.d) and the deprecated IPv4-compatible form
    // (::a.b.c.d). URL parsing rewrites both into hex — [::ffff:192.168.1.1]
    // becomes ::ffff:c0a8:101 — so the dotted form alone isn't enough.
    const dotted = lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isBlockedIp(dotted[1]);
    const hex = lower.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isBlockedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }
  return false;
}

/** Parse the URL and confirm it's http(s) and every address its host resolves to is public. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (host === "localhost" || host.endsWith(".localhost")) throw new UnsafeUrlError("That host is not allowed.");

  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new UnsafeUrlError("Couldn't resolve that host.");
      });
  if (addresses.length === 0) throw new UnsafeUrlError("Couldn't resolve that host.");
  if (addresses.some((a) => isBlockedIp(a.address))) throw new UnsafeUrlError("That host is not allowed.");
  return url;
}

export interface FetchedPage {
  status: number;
  ok: boolean;
  /** Where the redirects ended up. */
  finalUrl: string;
  /** The body, cut off at maxBytes. Empty for a non-2xx response. */
  body: string;
}

/**
 * GET a user-supplied URL, following up to five redirects by hand so each
 * destination is checked before it's requested. Throws UnsafeUrlError for a
 * blocked hop and a plain Error (with a readable message) for timeouts.
 */
export async function fetchPublicPage(
  raw: string,
  opts: { timeoutMs: number; maxBytes: number; accept?: string },
): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    let url = await assertPublicUrl(raw);
    for (let hop = 0; ; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (location) {
        if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects.");
        await res.body?.cancel();
        url = await assertPublicUrl(new URL(location, url));
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return { status: res.status, ok: false, finalUrl: url.href, body: "" };
      }
      const buf = await res.arrayBuffer();
      const bytes = buf.byteLength > opts.maxBytes ? buf.slice(0, opts.maxBytes) : buf;
      return { status: res.status, ok: true, finalUrl: url.href, body: new TextDecoder("utf-8").decode(bytes) };
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("The site took too long to respond.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** The first schema.org JobPosting object in the page's JSON-LD blocks, if any. */
export function findJobPostingJsonLd(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "@graph" in parsed
        ? ((parsed as { "@graph": unknown[] })["@graph"] ?? [])
        : [parsed];
    for (const c of candidates) {
      if (!c || typeof c !== "object") continue;
      const type = (c as { "@type"?: unknown })["@type"];
      const isJob = Array.isArray(type)
        ? type.some((t) => String(t).includes("JobPosting"))
        : String(type).includes("JobPosting");
      if (isJob) return c as Record<string, unknown>;
    }
  }
  return null;
}

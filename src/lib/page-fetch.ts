import type { LookupAddress, LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

// Fetching URLs that users hand us: job postings, careers pages, shared sheets.
// Every hop must resolve to a public address — the first URL and each redirect
// it leads to — so a public link can't bounce the server onto its own network
// or a cloud metadata endpoint. Each request connects to the exact addresses
// that were checked; the host is never looked up a second time, so a DNS answer
// that changes between the check and the connection can't slip past it.

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

/** A URL that passed the check, with the addresses its host resolved to. */
interface CheckedUrl {
  url: URL;
  addresses: LookupAddress[];
}

async function checkUrl(raw: string | URL): Promise<CheckedUrl> {
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

  const family = net.isIP(host);
  const addresses: LookupAddress[] = family
    ? [{ address: host, family }]
    : await lookup(host, { all: true }).catch(() => {
        throw new UnsafeUrlError("Couldn't resolve that host.");
      });
  if (addresses.length === 0) throw new UnsafeUrlError("Couldn't resolve that host.");
  if (addresses.some((a) => isBlockedIp(a.address))) throw new UnsafeUrlError("That host is not allowed.");
  return { url, addresses };
}

/** Parse the URL and confirm it's http(s) and every address its host resolves to is public. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  return (await checkUrl(raw)).url;
}

/** One HTTP exchange, before the body is read. */
export interface Hop {
  status: number;
  location: string | null;
  /** The decoded body, cut off at maxBytes. */
  read(maxBytes: number): Promise<Buffer>;
  discard(): void;
}

/** Sends one GET to `url`, connecting only to `addresses`. Swappable in tests. */
export type Transport = (
  url: URL,
  addresses: LookupAddress[],
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Hop>;

/** A dns.lookup stand-in that answers with the addresses already checked. */
function pinnedLookup(addresses: LookupAddress[]) {
  return (
    _host: string,
    options: LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  };
}

function readCapped(res: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
  const body =
    encoding === "gzip" || encoding === "x-gzip" ? res.pipe(zlib.createGunzip())
    : encoding === "br" ? res.pipe(zlib.createBrotliDecompress())
    : encoding === "deflate" ? res.pipe(zlib.createInflate())
    : res;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    body.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= maxBytes) {
        resolve(Buffer.concat(chunks).subarray(0, maxBytes));
        res.destroy();
      }
    });
    body.on("end", () => resolve(Buffer.concat(chunks)));
    body.on("error", reject);
  });
}

/** The real transport: node:http(s) with the connection pinned to the checked addresses. */
export const httpTransport: Transport = (url, addresses, { headers, signal }) =>
  new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, { method: "GET", headers, signal, lookup: pinnedLookup(addresses) }, (res) => {
      const location = res.headers.location;
      resolve({
        status: res.statusCode ?? 0,
        location: typeof location === "string" ? location : null,
        read: (maxBytes) => readCapped(res, maxBytes),
        discard: () => res.destroy(),
      });
    });
    req.on("error", reject);
    req.end();
  });

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
  transport: Transport = httpTransport,
): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
  };
  try {
    let target = await checkUrl(raw);
    for (let hop = 0; ; hop++) {
      const res = await transport(target.url, target.addresses, { headers, signal: controller.signal });
      if (res.status >= 300 && res.status < 400 && res.location) {
        res.discard();
        if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects.");
        target = await checkUrl(new URL(res.location, target.url));
        continue;
      }
      const finalUrl = target.url.href;
      if (res.status < 200 || res.status >= 300) {
        res.discard();
        return { status: res.status, ok: false, finalUrl, body: "" };
      }
      const bytes = await res.read(opts.maxBytes);
      return { status: res.status, ok: true, finalUrl, body: new TextDecoder("utf-8").decode(bytes) };
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === "AbortError" || controller.signal.aborted)) {
      throw new Error("The site took too long to respond.");
    }
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

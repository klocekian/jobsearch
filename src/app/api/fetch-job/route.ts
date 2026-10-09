import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";
import { aiErrorResponse, parseBody } from "@/lib/api-response";
import { extractJobPosting } from "@/lib/job-extraction";

// Fetch a job posting by URL and extract company / title / description. Runs
// server-side: the page fetch and the Anthropic key stay off the client.
//
// Because the URL is user-supplied, we guard against SSRF (block private /
// loopback / link-local targets), cap the response size and time, then hand the
// cleaned text (plus any embedded JobPosting JSON-LD) to the AI for extraction.

export const runtime = "nodejs";

const RequestSchema = z.object({
  url: z.string().url().max(2000),
});

const MAX_BYTES = 2_000_000; // ~2 MB cap on the fetched page
const MAX_TEXT = 30_000; // chars of cleaned text sent to the model
const FETCH_TIMEOUT_MS = 10_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** True for loopback / private / link-local / unspecified addresses (SSRF). */
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
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return false;
}

/** Resolve the host and confirm every address is a public, fetchable target. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (host === "localhost") throw new Error("That host is not allowed.");

  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error("Couldn't resolve that host.");
      });
  if (addresses.length === 0) throw new Error("Couldn't resolve that host.");
  if (addresses.some((a) => isBlockedIp(a.address))) {
    throw new Error("That host is not allowed.");
  }
  return url;
}

async function fetchPage(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`The site returned ${res.status}.`);
    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    return new TextDecoder("utf-8").decode(bytes);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("The site took too long to respond.");
    }
    throw err instanceof Error ? err : new Error("Failed to fetch the page.");
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the first schema.org JobPosting object from any JSON-LD blocks. */
function extractJsonLd(html: string): string {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
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
      if (isJob) return JSON.stringify(c).slice(0, MAX_TEXT);
    }
  }
  return "";
}

/** Crude but dependency-free HTML → readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, RequestSchema);
  if (body.error) return body.error;
  const { url } = body.data;

  let html: string;
  try {
    const safe = await assertSafeUrl(url);
    html = await fetchPage(safe);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch the page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const jsonLd = extractJsonLd(html);
  const text = htmlToText(html);
  if (!jsonLd && text.length < 200) {
    return NextResponse.json(
      { error: "Couldn't read a posting at that URL (the site may block automated access). Paste it instead." },
      { status: 422 }
    );
  }

  try {
    const result = await extractJobPosting(userId, { text, jsonLd });
    if (!result) {
      return NextResponse.json(
        { error: "Couldn't find a job posting at that URL. Paste the description instead." },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    return aiErrorResponse(err, "Failed to extract the posting.");
  }
});

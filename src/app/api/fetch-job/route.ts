import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Fetch a job posting by URL and extract company / title / description. Runs
// server-side: the page fetch and the Anthropic key stay off the client.
//
// Because the URL is user-supplied, we guard against SSRF (block private /
// loopback / link-local targets), cap the response size and time, then hand the
// cleaned text (plus any embedded JobPosting JSON-LD) to Claude for extraction.

export const runtime = "nodejs";

const RequestSchema = z.object({
  url: z.string().url().max(2000),
});

const ResultSchema = z.object({
  company: z.string(),
  jobTitle: z.string(),
  jobDescription: z.string(),
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

const SYSTEM = [
  "You extract structured job-posting details from a fetched web page.",
  "Return the hiring company name, the job title, and the full job description as plain text.",
  "jobDescription should include the substance of the posting: summary, responsibilities, requirements/qualifications, and any 'about the role' content, as readable plain text (no HTML, no markdown).",
  "Use the JSON-LD JobPosting data when present; otherwise extract from the page text.",
  "If the page is a login wall, a bot/captcha block, a job-search listing rather than a single posting, or otherwise not a single job posting, return empty strings for all three fields.",
  "Do not invent details. Only return what the page supports.",
].join("\n");

export async function POST(request: Request) {
  let url: string;
  try {
    const body: unknown = await request.json();
    url = RequestSchema.parse(body).url;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

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
    const client = await getAnthropicClient();
    const userContent = [
      jsonLd ? `=== JSON-LD JobPosting ===\n${jsonLd}\n` : "",
      `=== PAGE TEXT ===\n${text}`,
      "",
      "Extract the company, job title, and full job description.",
    ].join("\n");

    const message = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });

    const result = message.parsed_output;
    if (!result || (!result.jobTitle.trim() && !result.jobDescription.trim())) {
      return NextResponse.json(
        { error: "Couldn't find a job posting at that URL. Paste the description instead." },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Claude is not connected. Go to Profile and add your API key to use AI features." }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited by the Anthropic API. Try again shortly." }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Failed to extract the posting.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

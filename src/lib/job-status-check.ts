import { lookup } from "node:dns/promises";
import net from "node:net";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 1_500_000;

function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0 || p[0] === 127 || p[0] === 10) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid protocol");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost") throw new Error("Blocked host");

  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error("DNS resolution failed");
      });
  if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
    throw new Error("Blocked host address");
  }
  return url;
}

const CLOSED_PHRASES: string[] = [
  "no longer accepting applications",
  "no longer accepting candidates",
  "no longer accepting submissions",
  "no longer accepting",
  "no longer available",
  "no longer active",
  "no longer open",
  "not accepting applications",
  "not currently accepting applications",
  "position has been filled",
  "position has been closed",
  "position is filled",
  "position is closed",
  "this job has been closed",
  "this job has been filled",
  "this job is closed",
  "this job is no longer",
  "this job is no longer available",
  "this job is no longer accepting",
  "this job is no longer active",
  "this job is no longer open",
  "this posting has been closed",
  "this posting has been removed",
  "this posting has expired",
  "this posting is closed",
  "this posting is no longer active",
  "this role has been filled",
  "this role has been closed",
  "this role is closed",
  "this role is no longer accepting",
  "this role is no longer open",
  "this position has been closed",
  "this position has been filled",
  "this position is closed",
  "this position is no longer",
  "this opportunity is no longer",
  "this vacancy is closed",
  "this opening is closed",
  "this opening has been filled",
  "job has expired",
  "job post expired",
  "job posting has expired",
  "job posting expired",
  "posting has expired",
  "listing has expired",
  "listing has ended",
  "applications are closed",
  "application closed",
  "applications closed",
  "applications are no longer being accepted",
  "applications are no longer accepted",
  "job is closed",
  "we are no longer accepting",
  "we are no longer taking applications",
  "the job you are looking for is no longer available",
  "the job you are looking for has been filled",
  "the job you are looking for has expired",
  "the job you are trying to view is no longer available",
  "the job you requested could not be found",
  "the job you requested is no longer open",
  "the position you are looking for is no longer available",
  "the posting you are looking for has expired",
  "the requisition has been closed",
  "sorry, this job is no longer available",
  "sorry, this position has been filled",
  "sorry, this posting has expired",
  "sorry, this job is closed",
  "job not found",
  "page not found",
  "404 - not found",
  "404 not found",
  "404: not found",
  "we couldn't find the job",
  "we couldn't find that job",
  "the page you are looking for no longer exists",
  "this job post is closed",
  "this listing is inactive",
  "this listing is no longer available",
  "this job has been removed",
  "job has been removed",
  "there are no open positions at this time",
];

const CLOSED_REGEXES: RegExp[] = [
  /\bno\s+longer\s+accepting\s+(applications|candidates|submissions|resumes)\b/i,
  /\bthis\s+(job|position|role|posting|opening|opportunity|requisition)\s+(is|has\s+been)\s+(closed|filled|expired|archived|removed|cancelled|canceled|paused)\b/i,
  /\b(job|position|role|posting|opening|opportunity|listing|requisition)\s+(has\s+expired|is\s+closed|is\s+expired|was\s+closed|was\s+filled)\b/i,
  /\bapplications?\s+(are|is|have\s+been)\s+(closed|no\s+longer\s+accepted|no\s+longer\s+being\s+accepted)\b/i,
  /\bthe\s+(job|position|posting|role)\s+you\s+(are\s+looking\s+for|requested|are\s+trying\s+to\s+view)\s+(is\s+no\s+longer|has\s+expired|has\s+been\s+filled|could\s+not\s+be\s+found)\b/i,
  /\bsorry,\s+this\s+(job|position|posting|role)\s+is\s+(no\s+longer\s+available|no\s+longer\s+open|closed|filled)\b/i,
];

function htmlToCleanText(html: string): string {
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
    .trim();
}

/** Check if the URL was redirected away from a specific job post to a general careers/home page */
function isRedirectedAway(originalUrlStr: string, finalUrlStr: string): boolean {
  try {
    const orig = new URL(originalUrlStr);
    const final = new URL(finalUrlStr);

    const origPath = orig.pathname.replace(/\/+$/, "").toLowerCase();
    const finalPath = final.pathname.replace(/\/+$/, "").toLowerCase();

    // If paths match, it wasn't redirected to a different page
    if (orig.origin === final.origin && origPath === finalPath) {
      // But check if query params like ?gh_jid= or ?jobId= were stripped
      if (
        (orig.searchParams.has("gh_jid") && !final.searchParams.has("gh_jid")) ||
        (orig.searchParams.has("jobId") && !final.searchParams.has("jobId")) ||
        (orig.searchParams.has("jk") && !final.searchParams.has("jk"))
      ) {
        return true;
      }
      return false;
    }

    // Common ATS job deep path markers that represent a specific job posting
    const isOrigDeepJob =
      /\/jobs\/\d+/i.test(origPath) ||
      /\/job\/[^\s/]+/i.test(origPath) ||
      /\/viewjob\b/i.test(origPath) ||
      /\/o\/[0-9a-z-]+/i.test(origPath) || // Lever job ID
      orig.searchParams.has("gh_jid") ||
      orig.searchParams.has("jobId") ||
      orig.searchParams.has("jk") ||
      orig.searchParams.has("currentJobId");

    // General careers landing pages
    const isFinalGeneralLanding =
      finalPath === "" ||
      finalPath === "/" ||
      finalPath === "/jobs" ||
      finalPath === "/careers" ||
      finalPath === "/careers/" ||
      finalPath === "/search" ||
      finalPath === "/jobs/search" ||
      finalPath.endsWith("/careers") ||
      finalPath.endsWith("/jobs");

    if (isOrigDeepJob && isFinalGeneralLanding) {
      return true;
    }

    // Lever: /company/job-uuid redirected to /company
    if (orig.hostname.includes("lever.co") && origPath.split("/").filter(Boolean).length >= 2) {
      if (finalPath.split("/").filter(Boolean).length === 1) {
        return true;
      }
    }

    // Greenhouse: /company/jobs/12345 redirected to /company
    if (orig.hostname.includes("greenhouse.io") && origPath.includes("/jobs/")) {
      if (!finalPath.includes("/jobs/")) {
        return true;
      }
    }

    // Ashby: /company/job-id redirected to /company
    if (orig.hostname.includes("ashbyhq.com") && origPath.split("/").filter(Boolean).length >= 2) {
      if (finalPath.split("/").filter(Boolean).length === 1) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/** Check JSON-LD for expiration date */
function checkJsonLdJobPosting(html: string): { found: boolean; isExpired: boolean; validThrough?: string } {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "@graph" in parsed
          ? (parsed as { "@graph": unknown[] })["@graph"] ?? []
          : [parsed];

      for (const c of candidates) {
        if (!c || typeof c !== "object") continue;
        const type = (c as { "@type"?: unknown })["@type"];
        const isJob = Array.isArray(type)
          ? type.some((t) => String(t).includes("JobPosting"))
          : String(type).includes("JobPosting");

        if (isJob) {
          const validThrough = (c as { validThrough?: string }).validThrough;
          if (validThrough) {
            const expDate = new Date(validThrough);
            if (!isNaN(expDate.getTime()) && expDate < new Date()) {
              return { found: true, isExpired: true, validThrough };
            }
          }
          return { found: true, isExpired: false, validThrough };
        }
      }
    } catch {
      continue;
    }
  }
  return { found: false, isExpired: false };
}

export interface JobCheckResult {
  id: number;
  company: string;
  title: string;
  status: "closed" | "open" | "unknown";
  reason: string;
}

export async function checkJobStatus(job: {
  id: number;
  url: string;
  company?: string;
  title?: string;
}): Promise<JobCheckResult> {
  const result: JobCheckResult = {
    id: job.id,
    company: job.company || "",
    title: job.title || "",
    status: "unknown",
    reason: "",
  };

  if (!job.url) {
    result.status = "unknown";
    result.reason = "No URL provided";
    return result;
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(job.url);
  } catch (err: unknown) {
    result.status = "unknown";
    result.reason = err instanceof Error ? err.message : "Invalid URL";
    return result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let finalUrl = job.url;
  let html = "";

  try {
    const res = await fetch(safeUrl, {
      method: "GET",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    finalUrl = res.url || job.url;

    if (res.status === 404 || res.status === 410) {
      result.status = "closed";
      result.reason = `HTTP ${res.status} Not Found / Gone`;
      return result;
    }

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      result.status = "unknown";
      result.reason = `Site blocked automated check (HTTP ${res.status} - requires browser)`;
      return result;
    }

    if (!res.ok) {
      result.status = "unknown";
      result.reason = `Server returned HTTP ${res.status}`;
      return result;
    }

    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    html = new TextDecoder("utf-8").decode(bytes);
  } catch (err: unknown) {
    result.status = "unknown";
    result.reason = err instanceof Error ? err.message : "Network request failed";
    return result;
  } finally {
    clearTimeout(timer);
  }

  // 1. Check if redirected to generic landing/careers page
  if (isRedirectedAway(job.url, finalUrl)) {
    result.status = "closed";
    result.reason = `Redirected to general careers page (${new URL(finalUrl).pathname})`;
    return result;
  }

  // 2. Check JSON-LD JobPosting schema
  const jsonLdInfo = checkJsonLdJobPosting(html);
  if (jsonLdInfo.found && jsonLdInfo.isExpired) {
    result.status = "closed";
    result.reason = `Posting expiration date (${jsonLdInfo.validThrough}) has passed`;
    return result;
  }

  // 3. Clean HTML and search text
  const cleanText = htmlToCleanText(html);
  const textLower = cleanText.toLowerCase();

  // 4. Check explicit closed phrases
  for (const phrase of CLOSED_PHRASES) {
    if (textLower.includes(phrase)) {
      result.status = "closed";
      result.reason = `Found closed indicator: "${phrase}"`;
      return result;
    }
  }

  // 5. Check regex patterns
  for (const rx of CLOSED_REGEXES) {
    const match = textLower.match(rx);
    if (match) {
      result.status = "closed";
      result.reason = `Matched closed notice: "${match[0]}"`;
      return result;
    }
  }

  // 6. Check if page is an empty client-rendered SPA shell (Ashby, Workday, etc.)
  // Client-rendered apps load the job details via JavaScript in the browser.
  // Without browser JS, cleanText is very short. Never guess "closed" on an SPA shell.
  const isSpaShell =
    cleanText.length < 500 &&
    (html.includes("id=\"root\"") ||
      html.includes("id=\"__next\"") ||
      html.includes("ashby") ||
      html.includes("greenhouse") ||
      html.includes("lever") ||
      html.includes("workday"));

  if (isSpaShell) {
    result.status = "open";
    result.reason = "Client-rendered posting (active)";
    return result;
  }

  result.status = "open";
  result.reason = "Job posting is active";
  return result;
}

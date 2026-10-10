import { NextResponse } from "next/server";
import { z } from "zod";
import { htmlToText } from "@/lib/html-text";
import { fetchPublicPage, findJobPostingJsonLd } from "@/lib/page-fetch";
import { withUser } from "@/lib/api-auth";
import { aiErrorResponse, parseBody } from "@/lib/api-response";
import { extractJobPosting } from "@/lib/job-extraction";

// Fetch a job posting by URL and extract company / title / description. Runs
// server-side: the page fetch and the Anthropic key stay off the client.
//
// The URL is user-supplied, so lib/page-fetch checks every hop (redirects
// included) against private / loopback / link-local targets and caps size and
// time. The cleaned text, plus any embedded JobPosting JSON-LD, goes to the AI.

export const runtime = "nodejs";

const RequestSchema = z.object({
  url: z.string().url().max(2000),
});

const MAX_BYTES = 2_000_000; // ~2 MB cap on the fetched page
const MAX_TEXT = 30_000; // chars of cleaned text sent to the model
const FETCH_TIMEOUT_MS = 10_000;

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, RequestSchema);
  if (body.error) return body.error;
  const { url } = body.data;

  let html: string;
  try {
    const page = await fetchPublicPage(url, { timeoutMs: FETCH_TIMEOUT_MS, maxBytes: MAX_BYTES, accept: "text/html,application/xhtml+xml" });
    if (!page.ok) throw new Error(`The site returned ${page.status}.`);
    html = page.body;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch the page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const posting = findJobPostingJsonLd(html);
  const jsonLd = posting ? JSON.stringify(posting).slice(0, MAX_TEXT) : "";
  const text = htmlToText(html).slice(0, MAX_TEXT);
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

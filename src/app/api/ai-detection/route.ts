import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// AI-authorship detection via the model itself — more reliable than surface
// heuristics. Returns a calibrated confidence plus the specific LLM stylistic
// tells found, each with verbatim evidence. Runs server-side (key stays off the
// client). The client falls back to the local heuristic if this is unavailable.

export const runtime = "nodejs";

const RequestSchema = z.object({
  resumeText: z.string().min(1).max(60_000),
});

const PatternSchema = z.object({
  label: z.string(),
  /** 0-100: how strongly this tell is present. */
  signal: z.number(),
  message: z.string(),
  /** Verbatim quotes from the resume that show the tell. */
  examples: z.array(z.string()),
});

const ResultSchema = z.object({
  /** 0-100 overall likelihood the text was written/heavily edited by an LLM. */
  confidence: z.number(),
  patterns: z.array(PatternSchema),
});

const SYSTEM = [
  "You are an expert at detecting AI-generated or AI-heavily-edited prose. Judge how much a resume reads as written by a large language model.",
  "Look for genuine LLM stylistic signatures, and quote verbatim evidence for each you find:",
  "- Antithesis / negative parallelism: \"it's not X, it's Y\", \"not just X, but Y\", \"not only... but also\".",
  "- Em-dashes (—) used as prose punctuation mid-sentence (NOT dashes in dated headers like 'Director — Company' or date ranges like '2018 – 2023').",
  "- AI buzzwords/filler: delve, leverage, seamless, robust, tapestry, testament, underscore, pivotal, realm, resonate, holistic, myriad, elevate, unlock; stock openers like \"In today's...\", \"At the intersection of...\".",
  "- Rule-of-three triads used for rhythm; uniformly smooth sentence rhythm; vague, generic phrasing that lacks concrete, specific detail.",
  "CALIBRATION — this matters: a normal, well-written human resume is NOT AI. Do NOT treat round numbers, strong action verbs (led, drove, built), quantified metrics, or parallel bullet structure as AI signals — those are standard, good resume writing. Only flag true LLM stylistic tells. If there is little real evidence, return a low confidence and few or no patterns.",
  "For each tell actually present, return one pattern: label (short), signal 0-100 (strength), message (one-sentence explanation), examples (verbatim quotes from the resume, up to 5; never invent text).",
  "Return an overall confidence 0-100 reflecting how AI-authored the writing reads.",
].join("\n");

export async function POST(request: Request) {
  let resumeText: string;
  try {
    const body: unknown = await request.json();
    resumeText = RequestSchema.parse(body).resumeText;
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request body." }, { status: 400 });
  }

  try {
    const client = await getAnthropicClient();
    const message = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{ role: "user", content: `=== RESUME ===\n${resumeText}\n\nAssess AI authorship now.` }],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });

    const result = message.parsed_output;
    if (!result) {
      return NextResponse.json({ error: "The model returned an empty response." }, { status: 502 });
    }
    const confidence = Math.max(0, Math.min(100, Math.round(result.confidence)));
    const band = confidence >= 66 ? "high" : confidence >= 33 ? "moderate" : "low";
    const patterns = result.patterns.map((p) => ({
      label: p.label,
      signal: Math.max(0, Math.min(100, Math.round(p.signal))),
      message: p.message,
      examples: p.examples.slice(0, 5),
    }));
    return NextResponse.json({ confidence, band, patterns });
  } catch (err: unknown) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Claude is not connected. Go to Profile and add your API key to use AI features." }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited by the Anthropic API. Try again shortly." }, { status: 429 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to analyze." }, { status: 502 });
  }
}

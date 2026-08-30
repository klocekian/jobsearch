import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { getCandidateProfiles } from "@/lib/db/candidate-docs";
import { FitnessResultSchema } from "@/lib/fitness/schema";
import { FITNESS_SYSTEM_PROMPT, buildFitnessUserMessage } from "@/lib/fitness/prompt";
import { renderFitnessText } from "@/lib/fitness/render";

export const runtime = "nodejs";
// The report is long and the model reasons through every requirement.
export const maxDuration = 300;

/**
 * Opus only, deliberately.
 *
 * Sonnet was measured against it on 2026-08-30 and retired: it scored a soft
 * case 5 where Opus repeatably scored 7, it varied between runs where Opus did
 * not, and its rationale let a logistics item demote the band — which
 * contradicts the spec's rule that logistics is light-touch and hardens only at
 * offer stage. A model that reasons against the spec is not a cheap fallback.
 */
const MODEL = "claude-opus-5";

const MAX_TOKENS = 16_000;

const RequestSchema = z.object({
  job_id: z.number().int().positive(),
});

export async function POST(request: Request) {
  let jobId: number;
  try {
    const body: unknown = await request.json();
    jobId = RequestSchema.parse(body).job_id;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const job = await getJob(jobId, userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const posting = (job.posting_text ?? "").trim();
  if (!posting) {
    return NextResponse.json(
      { error: "This job has no posting text to check. Paste the posting first." },
      { status: 422 },
    );
  }

  // Refuse rather than degrade. Without the negative profile this is a
  // similarity scorer, which is the exact instrument the fitness check exists
  // to replace — and a check that silently scores against half a profile is
  // worse than no check, because it looks like one.
  const { profile, gaps } = await getCandidateProfiles(userId);
  const missing: string[] = [];
  if (!profile) missing.push("positive profile");
  if (!gaps) missing.push("negative profile (gaps)");
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Fitness check needs your ${missing.join(" and ")}. Add ${
          missing.length > 1 ? "them" : "it"
        } under Profile → Candidate Profile.`,
        code: "missing_candidate_docs",
        missing,
      },
      { status: 409 },
    );
  }

  try {
    const client = await getAnthropicClient();
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: FITNESS_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildFitnessUserMessage({ profile, gaps, posting }) },
      ],
      output_config: { format: zodOutputFormat(FitnessResultSchema) },
    });

    // Keep the CLI's diagnostic: a truncated result is a specific, fixable
    // failure, not a generic one. Rendering a half-report as though it were
    // whole is how a missing MISS goes unnoticed.
    if (message.stop_reason === "max_tokens") {
      return NextResponse.json(
        {
          error:
            `The model hit the ${MAX_TOKENS} token ceiling and the result was cut off. ` +
            "Trim the posting text, or shorten the profile documents.",
          code: "max_tokens",
        },
        { status: 502 },
      );
    }

    const result = message.parsed_output;
    if (!result) {
      return NextResponse.json(
        { error: `No structured result returned (stop_reason=${message.stop_reason}).` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result,
      text: renderFitnessText(result),
      model: MODEL,
      run_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Anthropic auth failed. Reconnect Claude on the Profile page." },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited. Try again shortly." }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Fitness check failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

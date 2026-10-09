import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { getCandidateProfiles } from "@/lib/db/candidate-docs";
import { FitnessResultSchema } from "@/lib/fitness/schema";
import { FITNESS_SYSTEM_PROMPT, buildFitnessUserMessage } from "@/lib/fitness/prompt";
import { renderFitnessText } from "@/lib/fitness/render";
import { generateStructured } from "@/lib/ai";

import { evaluateFitnessDeterministic } from "@/lib/fitness/deterministic";
import { saveFitnessRun } from "@/lib/db/analysis-runs";

export const runtime = "nodejs";
// The report is long and the model reasons through every requirement.
export const maxDuration = 300;

const MAX_TOKENS = 8192;

const RequestSchema = z.object({
  job_id: z.number().int().positive(),
  use_ai: z.boolean().optional(),
});

export async function POST(request: Request) {
  let jobId: number;
  let useAi = false;
  try {
    const body: unknown = await request.json();
    const parsed = RequestSchema.parse(body);
    jobId = parsed.job_id;
    useAi = !!parsed.use_ai;
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

  const { profile, gaps } = await getCandidateProfiles(userId);
  const positiveProfile = profile ?? "";
  const negativeGaps = gaps ?? "";

  // Deterministic mode (fast, rule-based, no LLM required)
  if (!useAi) {
    const result = evaluateFitnessDeterministic({
      company: job.company || "Unknown Company",
      title: job.title || "Job Opportunity",
      location: job.location || "",
      salary: job.salary_text || "",
      posting,
      profile: positiveProfile,
      gaps: negativeGaps,
    });

    // Saved here rather than by the caller, so a run is never lost to a
    // closed tab — the AI run below can take minutes.
    const model = "deterministic:rule-based";
    const saved = await saveFitnessRun(job, result, model);
    return NextResponse.json({
      result,
      text: renderFitnessText(result),
      model,
      run_at: saved.run.created_at,
      run_id: saved.run.id,
      job: saved.job,
    });
  }

  // AI-powered mode
  if (!positiveProfile || !negativeGaps) {
    const missing: string[] = [];
    if (!positiveProfile) missing.push("positive profile");
    if (!negativeGaps) missing.push("negative profile (gaps)");
    return NextResponse.json(
      {
        error: `Fitness check with AI needs your ${missing.join(" and ")}. Add ${
          missing.length > 1 ? "them" : "it"
        } under Profile → Candidate Profile, or uncheck "with AI" for deterministic scoring.`,
        code: "missing_candidate_docs",
        missing,
      },
      { status: 409 },
    );
  }

  try {
    const { data: rawResult, model, provider } = await generateStructured({
      system: FITNESS_SYSTEM_PROMPT,
      prompt: buildFitnessUserMessage({ profile: positiveProfile, gaps: negativeGaps, posting }),
      schema: FitnessResultSchema,
      schemaName: "FitnessResult",
      maxTokens: MAX_TOKENS,
    });

    const result = {
      ...rawResult,
      company: rawResult.company || job.company || "Unknown Company",
      title: rawResult.title || job.title || "Job Opportunity",
      location: rawResult.location || job.location || "Not specified",
      salary: rawResult.salary || job.salary_text || "Not stated",
    };

    const saved = await saveFitnessRun(job, result, `${provider}:${model}`);
    return NextResponse.json({
      result,
      text: renderFitnessText(result),
      model: `${provider}:${model}`,
      run_at: saved.run.created_at,
      run_id: saved.run.id,
      job: saved.job,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fitness check failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

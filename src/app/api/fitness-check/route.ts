import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { getCandidateProfiles } from "@/lib/db/candidate-docs";
import { FitnessResultSchema } from "@/lib/fitness/schema";
import { FITNESS_SYSTEM_PROMPT, buildFitnessUserMessage } from "@/lib/fitness/prompt";
import { renderFitnessText } from "@/lib/fitness/render";
import { generateStructured } from "@/lib/ai";

export const runtime = "nodejs";
// The report is long and the model reasons through every requirement.
export const maxDuration = 300;

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
    const { data: result, model, provider } = await generateStructured({
      system: FITNESS_SYSTEM_PROMPT,
      prompt: buildFitnessUserMessage({ profile, gaps, posting }),
      schema: FitnessResultSchema,
      schemaName: "FitnessResult",
      maxTokens: MAX_TOKENS,
    });

    return NextResponse.json({
      result,
      text: renderFitnessText(result),
      model: `${provider}:${model}`,
      run_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fitness check failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

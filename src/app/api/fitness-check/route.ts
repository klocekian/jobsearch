import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { renderFitnessText } from "@/lib/fitness/render";
import { MissingCandidateDocsError, runAiFitness, runRuleBasedFitness } from "@/lib/services/jobs";
import { aiErrorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
// The AI report is long and the model reasons through every requirement.
export const maxDuration = 300;

const RequestSchema = z.object({
  job_id: z.number().int().positive(),
  use_ai: z.boolean().optional(),
});

export const POST = withUser(async (request, userId) => {
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

  const job = await getJob(jobId, userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(job.posting_text ?? "").trim()) {
    return NextResponse.json(
      { error: "This job has no posting text to check. Paste the posting first." },
      { status: 422 },
    );
  }

  try {
    const run = useAi ? await runAiFitness(userId, job) : await runRuleBasedFitness(userId, job);
    return NextResponse.json({
      result: run.result,
      text: renderFitnessText(run.result),
      model: run.model,
      run_at: run.run.created_at,
      run_id: run.run.id,
      job: run.job,
    });
  } catch (err: unknown) {
    if (err instanceof MissingCandidateDocsError) {
      const { missing } = err;
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
    return aiErrorResponse(err, "Fitness check failed.");
  }
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { listAnalysisRuns, saveMatchRun } from "@/lib/db/analysis-runs";
import type { MatchReport } from "@/lib/analysis/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Run history for a job: fitness and match runs, most recent first, without the reports. */
export async function GET(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), await getCurrentUserId());
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const runs = await listAnalysisRuns(job.id);
  return NextResponse.json({
    fitness: runs.filter((r) => r.kind === "fitness"),
    match: runs.filter((r) => r.kind === "match"),
  });
}

// The ATS match runs in the browser; this records the result. Fitness runs are
// recorded by /api/fitness-check itself.
const MatchRunSchema = z.object({
  kind: z.literal("match"),
  report: z.object({ score: z.number() }).passthrough(),
  resume_name: z.string().max(500).nullable().optional(),
  resume_text: z.string(),
});

export async function POST(request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), await getCurrentUserId());
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = MatchRunSchema.parse(await request.json());
    const saved = await saveMatchRun(job, body.report as unknown as MatchReport, {
      name: body.resume_name ?? null,
      text: body.resume_text,
    });
    return NextResponse.json({ run_id: saved.run.id, job: saved.job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

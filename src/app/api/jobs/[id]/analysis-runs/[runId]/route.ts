import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { getAnalysisRun, restoreAnalysisRun } from "@/lib/db/analysis-runs";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; runId: string }> };

async function findRun(ctx: Params) {
  const { id, runId } = await ctx.params;
  const job = await getJob(Number(id), await getCurrentUserId());
  if (!job) return null;
  return (await getAnalysisRun(job.id, Number(runId))) ?? null;
}

/** One run with its full report. */
export async function GET(_request: Request, ctx: Params) {
  const run = await findRun(ctx);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
}

/** Make this run the job's current report again. */
export async function POST(_request: Request, ctx: Params) {
  const run = await findRun(ctx);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await restoreAnalysisRun(run);
  return NextResponse.json({ job });
}

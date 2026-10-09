import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { getAnalysisRun, restoreAnalysisRun } from "@/lib/db/analysis-runs";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; runId: string }> };

async function findRun(userId: number, ctx: Params) {
  const { id, runId } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return null;
  return (await getAnalysisRun(job.id, Number(runId))) ?? null;
}

/** One run with its full report. */
export const GET = withUser<Params>(async (_request, userId, ctx) => {
  const run = await findRun(userId, ctx);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
});

/** Make this run the job's current report again. */
export const POST = withUser<Params>(async (_request, userId, ctx) => {
  const run = await findRun(userId, ctx);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await restoreAnalysisRun(run);
  return NextResponse.json({ job });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";
import { getJob } from "@/lib/db/jobs";
import { saveMatchResult } from "@/lib/services/jobs";
import type { MatchReport } from "@/lib/analysis/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// The ATS match runs in the browser; this stores the result as the job's
// current match. Fitness results are stored by /api/fitness-check itself.
const MatchSchema = z.object({
  report: z.object({ score: z.number() }).passthrough(),
  resume_name: z.string().max(500).nullable().optional(),
});

export const POST = withUser<Params>(async (request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = MatchSchema.parse(await request.json());
    const saved = await saveMatchResult(job, body.report as unknown as MatchReport, body.resume_name ?? null);
    return NextResponse.json({ job: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

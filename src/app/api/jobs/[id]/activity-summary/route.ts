import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/api-auth";
import { getJob, updateJob } from "@/lib/db/jobs";
import { listSubmissions } from "@/lib/db/submissions";
import { generateStructured } from "@/lib/ai";
import {
  ACTIVITY_SYSTEM_PROMPT,
  JobActivitySchema,
  buildActivityPrompt,
  serializeActivity,
} from "@/lib/job-activity";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Write the job's activity banner from its notes and signals with the user's AI provider. */
export async function POST(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const submissions = await listSubmissions(job.id);
    const { data } = await generateStructured({
      system: ACTIVITY_SYSTEM_PROMPT,
      prompt: buildActivityPrompt(job, submissions),
      schema: JobActivitySchema,
      schemaName: "JobActivity",
      maxTokens: 1024,
    });
    const updated = await updateJob(job.id, { activity_summary: serializeActivity(data, job, "ai") });
    return NextResponse.json({ job: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not summarize this job.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Clear the stored summary so the banner falls back to what the notes say. */
export async function DELETE(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await updateJob(job.id, { activity_summary: null });
  return NextResponse.json({ job: updated });
}

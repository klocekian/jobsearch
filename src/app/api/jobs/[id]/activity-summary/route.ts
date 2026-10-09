import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { aiErrorResponse } from "@/lib/api-response";
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
export const POST = withUser<Params>(async (_request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const submissions = await listSubmissions(job.id);
    const { data } = await generateStructured(userId, {
      system: ACTIVITY_SYSTEM_PROMPT,
      prompt: buildActivityPrompt(job, submissions),
      schema: JobActivitySchema,
      schemaName: "JobActivity",
      maxTokens: 1024,
    });
    const updated = await updateJob(job.id, { activity_summary: serializeActivity(data, job, "ai") });
    return NextResponse.json({ job: updated });
  } catch (err: unknown) {
    return aiErrorResponse(err, "Could not summarize this job.");
  }
});

/** Clear the stored summary so the banner falls back to what the notes say. */
export const DELETE = withUser<Params>(async (_request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await updateJob(job.id, { activity_summary: null });
  return NextResponse.json({ job: updated });
});

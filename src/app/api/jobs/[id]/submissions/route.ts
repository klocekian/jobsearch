import { NextResponse } from "next/server";
import { getJob } from "@/lib/db/jobs";
import { createSubmission } from "@/lib/db/submissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const jobId = Number(id);
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const body = (await request.json()) as {
      type?: string;
      label?: string;
      format?: string;
      content?: string;
    };
    const submission = await createSubmission({
      job_id: jobId,
      type: body.type ?? "other",
      label: body.label ?? "Untitled",
      format: body.format ?? "txt",
      content: body.content ?? "",
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getJob } from "@/lib/db/jobs";
import { createSubmission } from "@/lib/db/submissions";
import { withUser } from "@/lib/api-auth";
import { pdfBytes } from "@/lib/pdf-attachment";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const POST = withUser<Params>(async (request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const body = (await request.json()) as {
      type?: string;
      label?: string;
      format?: string;
      content?: string;
    };
    if (body.format === "pdf") pdfBytes(body.content ?? "");
    const submission = await createSubmission({
      job_id: job.id,
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
});

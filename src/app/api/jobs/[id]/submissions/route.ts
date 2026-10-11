import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob } from "@/lib/db/jobs";
import { createSubmission, SUBMISSION_FORMATS } from "@/lib/db/submissions";
import { withUser } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-response";
import { MAX_CONTENT_CHARS, pdfBytes } from "@/lib/pdf-attachment";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const SubmissionSchema = z.object({
  type: z.string().max(50).default("other"),
  label: z.string().max(500).default("Untitled"),
  format: z.enum(SUBMISSION_FORMATS).default("txt"),
  content: z.string().max(MAX_CONTENT_CHARS).default(""),
});

export const POST = withUser<Params>(async (request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await parseBody(request, SubmissionSchema);
  if (body.error) return body.error;
  if (body.data.format === "pdf") {
    try {
      pdfBytes(body.data.content);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid PDF." }, { status: 400 });
    }
  }
  const submission = await createSubmission({ job_id: job.id, ...body.data });
  return NextResponse.json({ submission }, { status: 201 });
});

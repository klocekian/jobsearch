import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob } from "@/lib/db/jobs";
import { getSubmission, updateSubmission, deleteSubmission, SUBMISSION_FORMATS } from "@/lib/db/submissions";
import { pdfBytes } from "@/lib/pdf-attachment";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; sid: string }> };

export const GET = withUser<Params>(async (request, userId, ctx) => {
  const { id, sid } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const submission = await getSubmission(Number(sid), job.id);
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  // ?inline=1 shows the file in the browser (the PDF preview); ?download=1 saves it.
  const inline = url.searchParams.get("inline") === "1";
  if ((inline || url.searchParams.get("download") === "1") && submission.content) {
    const mimeTypes: Record<string, string> = {
      md: "text/markdown", txt: "text/plain", pdf: "application/pdf",
    };
    const mime = mimeTypes[submission.format] ?? "text/plain";
    const safeName = submission.label.replace(/[^\w\s.-]/g, "-").replace(/-+/g, "-").trim();
    const body = submission.format === "pdf" ? new Uint8Array(Buffer.from(submission.content, "base64")) : submission.content;
    return new NextResponse(body, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}.${submission.format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (submission.content) {
    return NextResponse.json({ submission });
  }

  return NextResponse.json({ error: "No content" }, { status: 404 });
});

const UpdateSchema = z.object({
  label: z.string().max(500).optional(),
  format: z.enum(SUBMISSION_FORMATS).optional(),
  /** Text, or base64 when the format is pdf. */
  content: z.string().optional(),
});

export const PATCH = withUser<Params>(async (request, userId, ctx) => {
  const { id, sid } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const current = await getSubmission(Number(sid), job.id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = UpdateSchema.parse(await request.json());
    const format = data.format ?? current.format;
    // Changing between a PDF and text replaces the content, so it must come along.
    if (data.content === undefined && (format === "pdf") !== (current.format === "pdf")) {
      throw new Error(format === "pdf" ? "Choose a PDF to upload." : "Add the text.");
    }
    if (format === "pdf" && data.content !== undefined) pdfBytes(data.content);
    const submission = await updateSubmission(current.id, job.id, data);
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ submission });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

export const DELETE = withUser<Params>(async (_request, userId, ctx) => {
  const { id, sid } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const deleted = await deleteSubmission(Number(sid), job.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { getJob } from "@/lib/db/jobs";
import { getSubmission, deleteSubmission } from "@/lib/db/submissions";
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
  if (url.searchParams.get("download") === "1" && submission.content) {
    const mimeTypes: Record<string, string> = {
      md: "text/markdown", txt: "text/plain", pdf: "application/pdf",
    };
    const mime = mimeTypes[submission.format] ?? "text/plain";
    const safeName = submission.label.replace(/[^\w\s.-]/g, "-").replace(/-+/g, "-").trim();
    return new NextResponse(submission.content, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${safeName}.${submission.format}"`,
      },
    });
  }

  if (submission.content) {
    return NextResponse.json({ submission });
  }

  return NextResponse.json({ error: "No content" }, { status: 404 });
});

export const DELETE = withUser<Params>(async (_request, userId, ctx) => {
  const { id, sid } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const deleted = await deleteSubmission(Number(sid), job.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

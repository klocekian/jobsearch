import { NextResponse } from "next/server";
import { getSubmission, deleteSubmission } from "@/lib/db/submissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; sid: string }> };

export async function GET(request: Request, ctx: Params) {
  const { sid } = await ctx.params;
  const submission = await getSubmission(Number(sid));
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
}

export async function DELETE(_request: Request, ctx: Params) {
  const { sid } = await ctx.params;
  const deleted = await deleteSubmission(Number(sid));
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

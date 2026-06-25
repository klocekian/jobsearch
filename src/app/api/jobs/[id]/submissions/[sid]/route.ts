import { NextResponse } from "next/server";
import { getSubmission, deleteSubmission } from "@/lib/db/submissions";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const SUBMISSIONS_DIR = path.join(process.cwd(), "data", "submissions");

type Params = { params: Promise<{ id: string; sid: string }> };

export async function GET(_request: Request, ctx: Params) {
  const { sid } = await ctx.params;
  const submission = getSubmission(Number(sid));
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (submission.file_path) {
    const filePath = path.join(SUBMISSIONS_DIR, submission.file_path);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File missing from disk" }, { status: 404 });
    }
    const buffer = fs.readFileSync(filePath);
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      md: "text/markdown",
    };
    const mime = mimeTypes[submission.format] ?? "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${submission.label}.${submission.format}"`,
      },
    });
  }

  return NextResponse.json({ submission });
}

export async function DELETE(_request: Request, ctx: Params) {
  const { sid } = await ctx.params;
  const submission = getSubmission(Number(sid));
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (submission.file_path) {
    const filePath = path.join(SUBMISSIONS_DIR, submission.file_path);
    try { fs.unlinkSync(filePath); } catch { /* already gone */ }
  }

  deleteSubmission(submission.id);
  return NextResponse.json({ ok: true });
}

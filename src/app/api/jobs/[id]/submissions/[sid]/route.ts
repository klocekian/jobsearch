import { NextResponse } from "next/server";
import { getSubmission, deleteSubmission } from "@/lib/db/submissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; sid: string }> };

export async function GET(_request: Request, ctx: Params) {
  const { sid } = await ctx.params;
  const submission = await getSubmission(Number(sid));
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

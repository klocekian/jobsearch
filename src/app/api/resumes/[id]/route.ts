import { NextResponse } from "next/server";
import { z } from "zod";
import { getResume, updateResume, deleteResume } from "@/lib/db/resumes";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  name: z.string().max(200).optional(),
  content: z.string().optional(),
  file_name: z.string().max(500).optional(),
  is_default: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const resume = await getResume(Number(id));
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ resume });
}

export async function PATCH(request: Request, ctx: Params) {
  const { id } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const data = UpdateSchema.parse(body);
    const resume = await updateResume(Number(id), data);
    if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ resume });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const deleted = await deleteResume(Number(id));
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

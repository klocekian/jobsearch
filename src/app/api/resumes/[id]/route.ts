import { NextResponse } from "next/server";
import { z } from "zod";
import { getResume, updateResume, deleteResume, addResumeTag } from "@/lib/db/resumes";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  name: z.string().max(200).optional(),
  content: z.string().optional(),
  file_name: z.string().max(500).optional(),
  is_default: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export const GET = withUser<Params>(async (_request, userId, ctx) => {
  const { id } = await ctx.params;
  const resume = await getResume(Number(id), userId);
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ resume });
});

export const PATCH = withUser<Params>(async (request, userId, ctx) => {
  const { id } = await ctx.params;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.add_tag === "string") {
      await addResumeTag(Number(id), userId, body.add_tag);
      const resume = await getResume(Number(id), userId);
      if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ resume });
    }
    const data = UpdateSchema.parse(body);
    const resume = await updateResume(Number(id), userId, data);
    if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ resume });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

export const DELETE = withUser<Params>(async (_request, userId, ctx) => {
  const { id } = await ctx.params;
  const deleted = await deleteResume(Number(id), userId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

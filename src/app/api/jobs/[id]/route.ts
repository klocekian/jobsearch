import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob, updateJob, deleteJob } from "@/lib/db/jobs";
import { listSubmissions } from "@/lib/db/submissions";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  company: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  remote_type: z.string().max(50).optional(),
  salary_min: z.number().int().nullable().optional(),
  salary_max: z.number().int().nullable().optional(),
  salary_text: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  posting_text: z.string().optional(),
  notes: z.string().optional(),
  match_score: z.number().int().nullable().optional(),
  match_report: z.string().nullable().optional(),
  applied_at: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const job = await getJob(Number(id));
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const submissions = await listSubmissions(job.id);
  return NextResponse.json({ job, submissions });
}

export async function PATCH(request: Request, ctx: Params) {
  const { id } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const data = UpdateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) updates[k] = v;
    }
    if (data.status === "applied" && !data.applied_at) {
      updates.applied_at = new Date().toISOString().slice(0, 10);
    }
    const job = await updateJob(Number(id), updates);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const deleted = await deleteJob(Number(id));
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

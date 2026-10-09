import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob, updateJob, deleteJob, statusChangeUpdates } from "@/lib/db/jobs";
import { listSubmissions } from "@/lib/db/submissions";
import { normalizePostingText } from "@/lib/html-text";
import { withUser } from "@/lib/api-auth";

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
  match_resume_name: z.string().max(500).nullable().optional(),
  fitness_score: z.number().int().min(1).max(10).nullable().optional(),
  fitness_report: z.string().nullable().optional(),
  fitness_run_at: z.string().max(50).nullable().optional(),
  applied_at: z.string().nullable().optional(),
  previous_status: z.string().max(50).nullable().optional(),
  is_starred: z.number().int().min(0).max(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export const GET = withUser<Params>(async (_request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const submissions = await listSubmissions(job.id);
  return NextResponse.json({ job, submissions });
});

export const PATCH = withUser<Params>(async (request, userId, ctx) => {
  const { id } = await ctx.params;
  const current = await getJob(Number(id), userId);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body: unknown = await request.json();
    const data = UpdateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) updates[k] = v;
    }
    // Postings arrive from several capture routes and any of them can let rich
    // text markup through. Normalizing here covers all of them at once.
    if (typeof updates.posting_text === "string") {
      updates.posting_text = normalizePostingText(updates.posting_text);
    }
    if (data.status) {
      Object.assign(updates, statusChangeUpdates(data.status, current.status, { appliedAtGiven: !!data.applied_at }));
    }
    const job = await updateJob(current.id, updates);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

export const DELETE = withUser<Params>(async (_request, userId, ctx) => {
  const { id } = await ctx.params;
  const job = await getJob(Number(id), userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteJob(job.id);
  return NextResponse.json({ ok: true });
});

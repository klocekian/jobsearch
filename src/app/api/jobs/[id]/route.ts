import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob, deleteJob } from "@/lib/db/jobs";
import { listSubmissions } from "@/lib/db/submissions";
import { editJob, JobFieldsSchema } from "@/lib/services/jobs";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const UpdateSchema = JobFieldsSchema.extend({ is_starred: z.number().int().min(0).max(1).optional() });

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
    const data = UpdateSchema.parse(await request.json());
    const job = (await editJob(current, data)) ?? current;
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

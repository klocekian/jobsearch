import { NextResponse } from "next/server";
import { z } from "zod";
import { listJobs, createJob, findMatchingJob, mergeJob, type JobInsert } from "@/lib/db/jobs";
import { getCurrentUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

const CreateSchema = z.object({
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
  source: z.string().max(50).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") ?? undefined;
  const order = url.searchParams.get("order") as "asc" | "desc" | undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const userId = await getCurrentUserId();
  const jobs = await listJobs(userId, { sort, order, status, search });
  return NextResponse.json({ jobs }, {
    headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" },
  });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const data = CreateSchema.parse(body);
    const insert: JobInsert = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) (insert as Record<string, unknown>)[k] = v;
    }

    const userId = await getCurrentUserId();
    insert.user_id = userId;
    const existing = await findMatchingJob(userId, {
      company: data.company,
      title: data.title,
      url: data.url,
    });

    if (existing) {
      const job = await mergeJob(existing, insert);
      return NextResponse.json({ job, merged: true }, { status: 200 });
    }

    const job = await createJob(insert);
    return NextResponse.json({ job, merged: false }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

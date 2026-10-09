import { NextResponse } from "next/server";
import { z } from "zod";
import { listJobs } from "@/lib/db/jobs";
import { addJob, JobFieldsSchema } from "@/lib/services/jobs";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const CreateSchema = JobFieldsSchema.extend({ source: z.string().max(50).optional() });

export const GET = withUser(async (request, userId) => {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") ?? undefined;
  const order = url.searchParams.get("order") as "asc" | "desc" | undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const starred = url.searchParams.get("starred") === "1";

  const jobs = await listJobs(userId, { sort, order, status, search, starred: starred || undefined });
  return NextResponse.json({ jobs }, {
    headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" },
  });
});

export const POST = withUser(async (request, userId) => {
  try {
    const data = CreateSchema.parse(await request.json());
    const { job, merged } = await addJob(userId, data);
    return NextResponse.json({ job, merged }, { status: merged ? 200 : 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

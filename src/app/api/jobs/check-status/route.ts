import { NextResponse } from "next/server";
import { listJobs, getJob, updateJob, listRestorableJobs, restoreClosedJobs, confirmClosedJobs } from "@/lib/db/jobs";
import { withUser } from "@/lib/api-auth";
import { checkJobStatus } from "@/lib/job-status-check";

export const runtime = "nodejs";
export const maxDuration = 120;

const ACTIVE_STATUSES = new Set(["saved", "applying", "applied", "interview", "onsite", "offer"]);

export const GET = withUser(async (_request, userId) => {
  const jobs = await listRestorableJobs(userId);
  return NextResponse.json({
    canRestore: jobs.length > 0,
    restorableCount: jobs.length,
    jobs,
  });
});

export const POST = withUser(async (request, userId) => {

  let body: Record<string, unknown> | null = null;
  try {
    body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {}

  if (body && (body.action === "undo" || body.action === "restore")) {
    const res = await restoreClosedJobs(userId);
    return NextResponse.json({
      restored: res.restoredCount,
      restoredJobs: res.restoredJobs,
      message: `Restored ${res.restoredCount} job${res.restoredCount === 1 ? "" : "s"} to their previous status.`,
    });
  }

  if (body && body.action === "confirm") {
    const ids = Array.isArray(body.job_ids) ? body.job_ids.map(Number).filter(Number.isInteger) : [];
    const confirmed = await confirmClosedJobs(userId, ids);
    return NextResponse.json({ confirmed });
  }

  let singleJobId: number | null = null;
  if (body && "job_id" in body) {
    singleJobId = Number(body.job_id);
  }

  if (singleJobId) {
    const job = await getJob(singleJobId, userId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const result = await checkJobStatus(job);
    if (result.status === "closed" && ACTIVE_STATUSES.has(job.status)) {
      await updateJob(job.id, { status: "closed", previous_status: job.status });
    }
    return NextResponse.json({
      checked: 1,
      closed: result.status === "closed" ? 1 : 0,
      results: [result],
      closedJobs: result.status === "closed" ? [{ id: job.id, company: job.company, title: job.title, reason: result.reason }] : [],
    });
  }

  const jobs = await listJobs(userId, { sort: "created_at", order: "desc" });
  const toCheck = jobs.filter((j) => j.url && ACTIVE_STATUSES.has(j.status)).slice(0, 50);
  const results: { id: number; company: string; title: string; result: string; reason: string }[] = [];

  // Run in concurrent chunks of 5 to avoid connection flooding while completing quickly
  const CHUNK_SIZE = 5;
  for (let i = 0; i < toCheck.length; i += CHUNK_SIZE) {
    const chunk = toCheck.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (job) => {
        const check = await checkJobStatus(job);
        if (check.status === "closed") {
          await updateJob(job.id, { status: "closed", previous_status: job.status });
        }
        return {
          id: job.id,
          company: job.company,
          title: job.title,
          result: check.status,
          reason: check.reason,
        };
      })
    );
    results.push(...chunkResults);
  }

  const closed = results.filter((r) => r.result === "closed");
  return NextResponse.json({
    checked: results.length,
    closed: closed.length,
    closedJobs: closed.map((r) => ({ id: r.id, company: r.company, title: r.title, reason: r.reason })),
  });
});


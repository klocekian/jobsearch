import { NextResponse } from "next/server";
import { confirmClosedJobs, getJob, listRestorableJobs, restoreClosedJobs } from "@/lib/db/jobs";
import { withUser } from "@/lib/api-auth";
import { rateLimitedResponse } from "@/lib/api-response";
import { checkAndCloseJob, checkActiveJobs } from "@/lib/services/jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const singleJobId = body && "job_id" in body ? Number(body.job_id) : null;
  if (singleJobId) {
    const job = await getJob(singleJobId, userId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    let result;
    try {
      ({ result } = await checkAndCloseJob(job));
    } catch (err) {
      return rateLimitedResponse(err);
    }
    return NextResponse.json({
      checked: 1,
      closed: result.status === "closed" ? 1 : 0,
      results: [result],
      closedJobs: result.status === "closed" ? [{ id: job.id, company: job.company, title: job.title, reason: result.reason }] : [],
    });
  }

  let checked;
  try {
    checked = await checkActiveJobs(userId);
  } catch (err) {
    return rateLimitedResponse(err);
  }
  const closed = checked.filter((c) => c.result.status === "closed");
  return NextResponse.json({
    checked: checked.length,
    closed: closed.length,
    closedJobs: closed.map(({ job, result }) => ({ id: job.id, company: job.company, title: job.title, reason: result.reason })),
  });
});

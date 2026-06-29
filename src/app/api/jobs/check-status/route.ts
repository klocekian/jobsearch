import { NextResponse } from "next/server";
import { listJobs, updateJob } from "@/lib/db/jobs";
import { getCurrentUserId } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLOSED_PHRASES = [
  "no longer accepting",
  "no longer available",
  "position has been filled",
  "position has been closed",
  "this job has been closed",
  "this job is no longer",
  "this posting has been closed",
  "this role has been filled",
  "job has expired",
  "listing has expired",
  "applications are closed",
  "application closed",
  "job is closed",
  "we are no longer",
  "this position is no longer",
  "this opportunity is no longer",
  "job not found",
  "page not found",
];

const ACTIVE_STATUSES = new Set(["saved", "applying", "applied", "interview", "onsite", "offer"]);

async function checkUrl(url: string): Promise<"closed" | "open" | "unknown"> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 404 || res.status === 410) return "closed";

    const text = await res.text();
    const lower = text.toLowerCase().slice(0, 50000);

    for (const phrase of CLOSED_PHRASES) {
      if (lower.includes(phrase)) return "closed";
    }

    return "open";
  } catch {
    return "unknown";
  }
}

export async function POST() {
  const userId = await getCurrentUserId();
  const jobs = await listJobs(userId, { sort: "created_at", order: "desc" });

  const toCheck = jobs.filter((j) => j.url && ACTIVE_STATUSES.has(j.status));
  const results: { id: number; company: string; result: string }[] = [];

  for (const job of toCheck.slice(0, 20)) {
    const result = await checkUrl(job.url);
    results.push({ id: job.id, company: job.company, result });
    if (result === "closed") {
      await updateJob(job.id, { status: "closed", previous_status: job.status });
    }
  }

  const closed = results.filter((r) => r.result === "closed");
  return NextResponse.json({
    checked: results.length,
    closed: closed.length,
    closedJobs: closed.map((r) => ({ id: r.id, company: r.company })),
  });
}

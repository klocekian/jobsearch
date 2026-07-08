import { getCurrentUserId } from "@/lib/api-auth";
import { listJobs } from "@/lib/db/jobs";
import { JobsPageClient } from "@/components/JobsPageClient";

export default async function JobsPage() {
  const userId = await getCurrentUserId();
  // Not awaited — the promise streams to the client so the page shell (nav,
  // title, filter bar) paints immediately instead of blocking on the DB
  // round-trip. JobsList/JobsFunnel resolve it client-side once it lands.
  const jobsPromise = listJobs(userId, { sort: "created_at", order: "desc" });

  return <JobsPageClient jobsPromise={jobsPromise} />;
}

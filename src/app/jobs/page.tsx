import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listJobs } from "@/lib/db/jobs";
import { JobsPageClient } from "@/components/JobsPageClient";

export default async function JobsPage() {
  // The middleware only checks that a cookie exists; this verifies it.
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  // Not awaited — the promise streams to the client so the page shell (nav,
  // title, filter bar) paints immediately instead of blocking on the DB
  // round-trip. JobsList/JobsFunnel resolve it client-side once it lands.
  const jobsPromise = listJobs(userId, { sort: "created_at", order: "desc" });

  return <JobsPageClient jobsPromise={jobsPromise} />;
}

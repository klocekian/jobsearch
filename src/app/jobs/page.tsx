import { Suspense } from "react";
import { getCurrentUserId } from "@/lib/api-auth";
import { listJobs } from "@/lib/db/jobs";
import { JobsPageClient } from "@/components/JobsPageClient";

export default async function JobsPage() {
  const userId = await getCurrentUserId();
  const initialJobs = await listJobs(userId, { sort: "created_at", order: "desc" });

  return (
    <Suspense>
      <JobsPageClient initialJobs={initialJobs} />
    </Suspense>
  );
}

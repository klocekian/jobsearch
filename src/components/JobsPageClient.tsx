"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { JobRow } from "@/lib/db/jobs";
import { apiGet } from "@/lib/api-client";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { StrategyBanner } from "@/components/StrategyBanner";
import { AddJobForm } from "@/components/AddJobForm";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";

export function JobsPageClient({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const params = useSearchParams();
  const adding = params.get("add") === "1";

  // The whole list, newest first — one copy shared by the banner, the funnel
  // and the table's default view, so a change made in the table shows up in
  // all three. Seeded from the server-streamed promise, which is a Flight
  // thenable rather than a real Promise: its .then() returns undefined, so
  // chaining .catch() off it crashes — hence the two-argument form.
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  useEffect(() => {
    let ignore = false;
    jobsPromise.then(
      (initial) => { if (!ignore) setJobs(initial); },
      () => { if (!ignore) setJobs([]); },
    );
    return () => { ignore = true; };
  }, [jobsPromise]);

  const refreshJobs = useCallback(async () => {
    try {
      // Runs right after writes, so skip the short private cache /api/jobs allows.
      const data = await apiGet<{ jobs?: JobRow[] }>("/api/jobs?sort=created_at&order=desc", { cache: "no-store" });
      setJobs(data.jobs ?? []);
    } catch {
      // keep the list we have
    }
  }, []);

  if (adding) {
    return (
      <main className="mx-auto w-full max-w-7xl px-5 py-8">
        <Text type="display-3" as="h1" className="mb-6">Add Job</Text>
        <Card>
          <div className="p-6">
            <AddJobForm />
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-5">
      <div className="space-y-4">
        <StrategyBanner jobs={jobs ?? []} />
        <JobsFunnel jobs={jobs ?? []} />
        <JobsList allJobs={jobs} setAllJobs={setJobs} refreshAllJobs={refreshJobs} />
      </div>
    </main>
  );
}

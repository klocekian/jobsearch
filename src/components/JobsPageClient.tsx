"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { JobRow } from "@/lib/db/jobs";
import { apiGet } from "@/lib/api-client";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { StrategyBanner } from "@/components/StrategyBanner";
import { AddJobForm } from "@/components/AddJobForm";
import { Card } from "@/components/ui/Card";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/iconstack/Icon";
import { SearchHome } from "./search/SearchHome";
import { searchPhase } from "@/lib/search-workflow";

export function JobsPageClient({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const params = useSearchParams();
  const adding = params.get("add") === "1";

  // The whole list, newest first — one copy shared by the banner, the funnel
  // and the table's default view, so a change made in the table shows up in
  // all three. Seeded from the server-streamed promise, which is a Flight
  // thenable rather than a real Promise: its .then() returns undefined, so
  // chaining .catch() off it crashes — hence the two-argument form.
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    jobsPromise.then(
      (initial) => { if (!ignore) setJobs(initial); },
      () => { if (!ignore) setError("Could not load your jobs."); },
    );
    return () => { ignore = true; };
  }, [jobsPromise]);

  const refreshJobs = useCallback(async () => {
    try {
      // Runs right after writes, so skip the short private cache /api/jobs allows.
      const data = await apiGet<{ jobs?: JobRow[] }>("/api/jobs?sort=created_at&order=desc", { cache: "no-store" });
      setJobs(data.jobs ?? []);
      setError(null);
    } catch {
      setError("Could not refresh your jobs. Please try again.");
    }
  }, []);

  if (adding) {
    return (
      <Page title="Save a job" crumb={{ label: "Explore", href: "/jobs?phase=explore" }} narrow>
        <Card className="p-5 sm:p-6">
          <AddJobForm />
        </Card>
      </Page>
    );
  }

  if (params.get("view") !== "tracker") {
    const phase = searchPhase(params.get("phase"));
    return <SearchHome key={`${phase}:${params.get("filter") ?? "all"}`} initialFilter={params.get("filter")} jobs={jobs} phase={phase} error={error} retry={() => void refreshJobs()} onJobChange={(job) => setJobs((list) => list?.map((j) => j.id === job.id ? job : j) ?? null)} />;
  }

  return (
    <Page
      title="All jobs & archive"
      crumb={{ label: "Library" }}
      actions={<Button label="Save a job" variant="primary" size="sm" href="/jobs?add=1" icon={<Icon name="plus" size={13} />} />}
    >
      <div className="space-y-4">
        <StrategyBanner jobs={jobs ?? []} />
        <JobsFunnel jobs={jobs ?? []} />
        <JobsList allJobs={jobs} setAllJobs={setJobs} refreshAllJobs={refreshJobs} />
      </div>
    </Page>
  );
}

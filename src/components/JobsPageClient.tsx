"use client";

import { useSearchParams } from "next/navigation";
import type { JobRow } from "@/lib/db/jobs";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { AddJobForm } from "@/components/AddJobForm";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";

export function JobsPageClient({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const params = useSearchParams();
  const adding = params.get("add") === "1";

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
    <main className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="mb-6">
        <Text type="display-3" as="h1">Jobs</Text>
      </div>
      <div className="space-y-6">
        <JobsFunnel />
        <JobsList jobsPromise={jobsPromise} />
      </div>
    </main>
  );
}

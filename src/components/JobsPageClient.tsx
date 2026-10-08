"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { AddJobForm } from "@/components/AddJobForm";
import { ChevronLeftIcon } from "@/components/icons";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";

export function JobsPageClient({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const params = useSearchParams();
  const adding = params.get("add") === "1";

  if (adding) {
    return (
      <main className="mx-auto w-full max-w-7xl px-5 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/jobs"
            aria-label="Back to jobs"
            className="-ml-1 inline-flex items-center justify-center rounded-md p-1.5 text-secondary transition hover:bg-surface hover:text-primary"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </Link>
          <Text type="display-3" as="h1">Add Job</Text>
        </div>
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
        <JobsFunnel />
        <JobsList jobsPromise={jobsPromise} />
      </div>
    </main>
  );
}

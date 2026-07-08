"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { JobRow } from "@/lib/db/jobs";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { AddJobForm } from "@/components/AddJobForm";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { HStack } from "@astryxdesign/core/Stack";

type JobsTab = "list" | "funnel";

export function JobsPageClient({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const params = useSearchParams();
  const adding = params.get("add") === "1";
  const [tab, setTab] = useState<JobsTab>("list");

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
    <main className="mx-auto flex h-[calc(100vh-57px)] w-full max-w-7xl flex-col px-5 py-8">
      <HStack className="mb-6 shrink-0 items-center justify-between">
        <Text type="display-3" as="h1">Jobs</Text>
        <SegmentedControl value={tab} onChange={(v) => setTab(v as JobsTab)} label="View mode">
          <SegmentedControlItem value="list" label="List" />
          <SegmentedControlItem value="funnel" label="Funnel" />
        </SegmentedControl>
      </HStack>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "list" && <JobsList jobsPromise={jobsPromise} />}
        {tab === "funnel" && <JobsFunnel jobsPromise={jobsPromise} />}
      </div>
    </main>
  );
}

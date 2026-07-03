"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { AddJobForm } from "@/components/AddJobForm";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { HStack } from "@astryxdesign/core/Stack";

type JobsTab = "list" | "funnel";

function JobsPageInner() {
  const params = useSearchParams();
  const adding = params.get("add") === "1";
  const [tab, setTab] = useState<JobsTab>("list");

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8">
      {adding ? (
        <>
          <Text type="display-3" as="h1" className="mb-6">Add Job</Text>
          <Card>
            <div className="p-6">
              <AddJobForm />
            </div>
          </Card>
        </>
      ) : (
        <>
          <HStack className="mb-6 items-center justify-between">
            <Text type="display-3" as="h1">Jobs</Text>
            <SegmentedControl value={tab} onChange={(v) => setTab(v as JobsTab)} label="View mode">
              <SegmentedControlItem value="list" label="List" />
              <SegmentedControlItem value="funnel" label="Funnel" />
            </SegmentedControl>
          </HStack>
          {tab === "list" && <JobsList />}
          {tab === "funnel" && <JobsFunnel />}
        </>
      )}
    </main>
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsPageInner />
    </Suspense>
  );
}

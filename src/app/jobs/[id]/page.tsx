"use client";

import { use } from "react";
import { JobDetail } from "@/components/JobDetail";

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <JobDetail jobId={Number(id)} />
    </main>
  );
}

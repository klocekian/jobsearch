"use client";

import { use } from "react";
import { JobWorkspace } from "@/components/JobWorkspace";

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <JobWorkspace jobId={Number(id)} />;
}

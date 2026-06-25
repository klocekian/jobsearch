"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { JobsList } from "@/components/JobsList";
import { AddJobForm } from "@/components/AddJobForm";

function JobsPageInner() {
  const params = useSearchParams();
  const adding = params.get("add") === "1";

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      {adding ? (
        <>
          <h1 className="mb-6 text-xl font-bold text-slate-900">Add Job</h1>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <AddJobForm />
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex items-baseline justify-between">
            <h1 className="text-xl font-bold text-slate-900">Jobs</h1>
          </div>
          <JobsList />
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

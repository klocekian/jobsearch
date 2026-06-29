"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { JobsList } from "@/components/JobsList";
import { JobsFunnel } from "@/components/JobsFunnel";
import { AddJobForm } from "@/components/AddJobForm";

type JobsTab = "list" | "funnel";

function JobsPageInner() {
  const params = useSearchParams();
  const adding = params.get("add") === "1";
  const [tab, setTab] = useState<JobsTab>("list");

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
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Jobs</h1>
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {(["list", "funnel"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                    tab === key ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {key === "list" ? "List" : "Funnel"}
                </button>
              ))}
            </div>
          </div>
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

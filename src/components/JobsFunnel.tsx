"use client";

import { useEffect, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS } from "@/lib/status";

const FUNNEL_ORDER = ["saved", "applying", "applied", "interview", "offer", "accepted"];

const FUNNEL_COLORS: Record<string, string> = {
  saved: "bg-slate-300",
  applying: "bg-amber-400",
  applied: "bg-blue-400",
  interview: "bg-emerald-400",
  offer: "bg-purple-400",
  accepted: "bg-green-500",
};

const TERMINAL = ["rejected", "declined", "withdrawn", "abandoned", "closed"];

export function JobsFunnel() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs?sort=created_at&order=desc")
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Loading...</p>;

  const counts: Record<string, number> = {};
  for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1;

  const funnelStages = FUNNEL_ORDER.map((status) => ({
    status,
    label: STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status,
    count: counts[status] ?? 0,
  }));

  const terminalCount = TERMINAL.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const max = Math.max(...funnelStages.map((s) => s.count), 1);

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Application Funnel</h2>
        <p className="mb-6 text-xs text-slate-400">{jobs.length} total jobs tracked</p>

        <div className="space-y-3">
          {funnelStages.map((stage) => (
            <div key={stage.status} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-right text-xs font-medium text-slate-600">
                {stage.label}
              </div>
              <div className="relative h-8 flex-1 rounded-lg bg-slate-50">
                {stage.count > 0 && (
                  <div
                    className={`h-full rounded-lg ${FUNNEL_COLORS[stage.status] ?? "bg-slate-300"} transition-all duration-500`}
                    style={{ width: `${Math.max((stage.count / max) * 100, 4)}%` }}
                  />
                )}
                <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-slate-700">
                  {stage.count}
                </span>
              </div>
            </div>
          ))}
        </div>

        {terminalCount > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="mb-2 text-xs font-medium text-slate-400">Ended</div>
            <div className="flex flex-wrap gap-3">
              {TERMINAL.map((s) => {
                const c = counts[s] ?? 0;
                if (c === 0) return null;
                const label = STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
                return (
                  <div key={s} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center">
                    <div className="text-lg font-semibold text-slate-700">{c}</div>
                    <div className="text-[10px] text-slate-400">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

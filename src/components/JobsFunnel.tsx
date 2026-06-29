"use client";

import { useEffect, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS } from "@/lib/status";

const FUNNEL_ORDER = ["saved", "applying", "applied", "interview", "offer", "accepted"];

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  saved: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700" },
  applying: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  applied: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  interview: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  offer: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  accepted: { bg: "bg-green-50", border: "border-green-400", text: "text-green-700" },
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

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Application Pipeline</h2>
        <p className="mb-8 text-xs text-slate-400">{jobs.length} total jobs tracked</p>

        {/* Pipeline flow */}
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {funnelStages.map((stage, i) => {
            const colors = STAGE_COLORS[stage.status] ?? STAGE_COLORS.saved;
            return (
              <div key={stage.status} className="flex items-center">
                <div className={`flex flex-col items-center rounded-xl border-2 ${colors.border} ${colors.bg} px-5 py-4 min-w-[90px]`}>
                  <div className={`text-2xl font-bold ${colors.text}`}>{stage.count}</div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">{stage.label}</div>
                </div>
                {i < funnelStages.length - 1 && (
                  <div className="flex items-center px-1">
                    <div className="h-0.5 w-6 bg-slate-200" />
                    <div className="h-0 w-0 border-y-[5px] border-l-[6px] border-y-transparent border-l-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Terminal statuses */}
        {TERMINAL.some((s) => (counts[s] ?? 0) > 0) && (
          <div className="mt-8 border-t border-slate-100 pt-4">
            <div className="mb-3 text-xs font-medium text-slate-400">Ended</div>
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

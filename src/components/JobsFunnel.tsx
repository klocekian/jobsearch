"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS, STATUS_COLORS } from "@/lib/status";

const PIPELINE = ["saved", "applying", "applied", "interview", "onsite", "offer", "accepted"];
const TERMINAL_LINES = [
  { status: "rejected", label: "Rejected", color: "text-rose-500", stages: ["applied", "interview", "onsite"] },
  { status: "abandoned", label: "Abandoned", color: "text-stone-500", stages: ["saved", "applying", "applied", "interview", "onsite", "offer"] },
  { status: "closed", label: "Closed", color: "text-slate-400", stages: ["saved", "applying", "applied", "interview", "onsite", "offer"] },
];

const DOT_COLORS: Record<string, string> = {
  total: "#1e293b", saved: "#94a3b8", applying: "#f59e0b", applied: "#3b82f6",
  interview: "#10b981", onsite: "#14b8a6", offer: "#8b5cf6", accepted: "#22c55e",
};

function labelFor(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

export function JobsFunnel() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ status: string; stage?: string } | null>(null);

  useEffect(() => {
    fetch("/api/jobs?sort=created_at&order=desc")
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Loading...</p>;

  const counts: Record<string, number> = {};
  for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1;

  const pipelineStages = [
    { status: "total", label: "Total", count: jobs.length },
    ...PIPELINE.map((s) => ({ status: s, label: labelFor(s), count: counts[s] ?? 0 })),
  ];
  const max = Math.max(...pipelineStages.map((s) => s.count), 1);

  // Terminal breakdown by previous_status
  const terminalByStage: Record<string, Record<string, number>> = {};
  for (const tl of TERMINAL_LINES) {
    terminalByStage[tl.status] = {};
    for (const stage of tl.stages) terminalByStage[tl.status][stage] = 0;
  }
  for (const j of jobs) {
    if (terminalByStage[j.status] && j.previous_status) {
      if (terminalByStage[j.status][j.previous_status] !== undefined) {
        terminalByStage[j.status][j.previous_status]++;
      }
    }
  }

  // SVG layout — main chart only
  const W = 720;
  const H = 180;
  const padX = 40;
  const padTop = 20;
  const padBot = 30;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBot;

  const xFor = (i: number) => padX + (pipelineStages.length > 1 ? (i / (pipelineStages.length - 1)) * chartW : chartW / 2);

  const mainPoints = pipelineStages.map((s, i) => ({
    ...s,
    x: xFor(i),
    y: padTop + chartH - (s.count / max) * chartH,
  }));
  const mainPath = mainPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  // Selected jobs
  let selectedJobs: JobRow[] = [];
  let selectedLabel = "";
  if (selected) {
    if (selected.status === "total") {
      selectedJobs = jobs;
      selectedLabel = "Total";
    } else if (selected.stage) {
      selectedJobs = jobs.filter((j) => j.status === selected.status && j.previous_status === selected.stage);
      selectedLabel = `${labelFor(selected.status)} (from ${labelFor(selected.stage)})`;
    } else {
      selectedJobs = jobs.filter((j) => j.status === selected.status);
      selectedLabel = labelFor(selected.status);
    }
  }

  const isSel = (status: string, stage?: string) => selected?.status === status && selected?.stage === stage;

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Application Pipeline</h2>
        <p className="mb-4 text-xs text-slate-400">{jobs.length} total jobs tracked</p>

        {/* Main pipeline chart */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
          {ticks.map((t) => {
            const y = padTop + chartH - (t / max) * chartH;
            return (
              <g key={t}>
                <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                <text x={padX - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{t}</text>
              </g>
            );
          })}
          <defs>
            <linearGradient id="aGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="30%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d={`${mainPath} L ${mainPoints[mainPoints.length - 1].x} ${padTop + chartH} L ${mainPoints[0].x} ${padTop + chartH} Z`}
            fill="url(#aGrad)" opacity={0.1}
          />
          <path d={mainPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" />
          {mainPoints.map((p) => (
            <g key={p.status} onClick={() => setSelected(isSel(p.status) ? null : { status: p.status })} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={isSel(p.status) ? 8 : 6} fill={DOT_COLORS[p.status] ?? "#94a3b8"} stroke="white" strokeWidth={2} />
              {p.count > 0 && <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={11} fill="#1e293b" fontWeight={600}>{p.count}</text>}
              <text x={p.x} y={padTop + chartH + 16} textAnchor="middle" fontSize={10} fill="#64748b">{p.label}</text>
            </g>
          ))}
        </svg>

        {/* Terminal rows */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          {TERMINAL_LINES.map((tl) => {
            const stageCounts = tl.stages.map((stage) => ({
              stage,
              count: terminalByStage[tl.status][stage],
              pipeIdx: PIPELINE.indexOf(stage) + 1,
            }));
            const total = stageCounts.reduce((s, c) => s + c.count, 0);
            return (
              <div key={tl.status} className="flex items-center gap-0 py-1.5">
                <div className={`w-[72px] shrink-0 text-right pr-3 text-[11px] font-semibold ${tl.color}`}>
                  {tl.label}
                </div>
                <div className="flex flex-1 items-center">
                  {pipelineStages.map((ps, pi) => {
                    const entry = stageCounts.find((sc) => sc.pipeIdx === pi);
                    return (
                      <div key={pi} className="flex-1 text-center">
                        {entry ? (
                          <button
                            onClick={() => setSelected(isSel(tl.status, entry.stage) ? null : { status: tl.status, stage: entry.stage })}
                            className={`inline-block min-w-[24px] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                              isSel(tl.status, entry.stage)
                                ? "bg-slate-800 text-white"
                                : entry.count > 0
                                  ? `${tl.color} hover:bg-slate-100`
                                  : "text-slate-200"
                            }`}
                          >
                            {entry.count}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-100">·</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="w-10 shrink-0 text-center text-[11px] font-semibold text-slate-400">{total}</div>
              </div>
            );
          })}
        </div>

        {/* Selected jobs list */}
        {selected && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{selectedLabel}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{selectedJobs.length}</span>
              <button onClick={() => setSelected(null)} className="ml-auto text-[10px] text-slate-400 hover:text-slate-600">Clear</button>
            </div>
            {selectedJobs.length === 0 ? (
              <p className="text-xs text-slate-400">No jobs in this stage.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {selectedJobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                    <div>
                      <span className="text-xs font-medium text-slate-800">{j.company || "—"}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="text-xs text-slate-500">{j.title || "—"}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[j.status] ?? ""}`}>{j.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

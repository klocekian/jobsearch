"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS, STATUS_COLORS } from "@/lib/status";

const PIPELINE = ["saved", "applying", "applied", "interview", "onsite", "offer", "accepted"];
const TERMINAL_LINES = [
  { status: "rejected", label: "Rejected", color: "#ef4444", stages: ["applied", "interview", "onsite"] },
  { status: "abandoned", label: "Abandoned", color: "#78716c", stages: ["saved", "applying", "applied", "interview", "onsite", "offer"] },
  { status: "closed", label: "Closed", color: "#9ca3af", stages: ["saved", "applying", "applied", "interview", "onsite", "offer"] },
];

const DOT_COLORS: Record<string, string> = {
  total: "#1e293b",
  saved: "#94a3b8",
  applying: "#f59e0b",
  applied: "#3b82f6",
  interview: "#10b981",
  onsite: "#14b8a6",
  offer: "#8b5cf6",
  accepted: "#22c55e",
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
      const stage = j.previous_status;
      if (terminalByStage[j.status][stage] !== undefined) {
        terminalByStage[j.status][stage]++;
      }
    }
  }
  const terminalMax = Math.max(
    ...TERMINAL_LINES.flatMap((tl) => Object.values(terminalByStage[tl.status])),
    1
  );

  // SVG layout
  const W = 720;
  const mainH = 180;
  const termH = 100;
  const gap = 40;
  const totalH = mainH + gap + termH * TERMINAL_LINES.length + 20;
  const padX = 40;
  const padTop = 20;
  const padBot = 30;

  const chartW = W - padX * 2;
  const mainChartH = mainH - padTop - padBot;

  function xFor(i: number, total: number) {
    return padX + (total > 1 ? (i / (total - 1)) * chartW : chartW / 2);
  }

  // Main pipeline points
  const mainPoints = pipelineStages.map((s, i) => ({
    ...s,
    x: xFor(i, pipelineStages.length),
    y: padTop + mainChartH - (s.count / max) * mainChartH,
  }));
  const mainPath = mainPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const mainTicks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  // Terminal line points
  const terminalData = TERMINAL_LINES.map((tl, li) => {
    const baseY = mainH + gap + li * termH;
    const innerH = termH - 30;
    const stageKeys = tl.stages;
    const points = stageKeys.map((stage, si) => {
      const c = terminalByStage[tl.status][stage];
      const pipeIdx = PIPELINE.indexOf(stage);
      return {
        stage,
        count: c,
        x: xFor(pipeIdx + 1, pipelineStages.length),
        y: baseY + innerH - (c / terminalMax) * innerH,
      };
    });
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return { ...tl, points, path, baseY, innerH };
  });

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

  const isSelected = (status: string, stage?: string) =>
    selected?.status === status && selected?.stage === stage;

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Application Pipeline</h2>
        <p className="mb-4 text-xs text-slate-400">{jobs.length} total jobs tracked</p>

        <svg viewBox={`0 0 ${W} ${totalH}`} className="w-full">
          {/* Main pipeline Y-axis */}
          {mainTicks.map((t) => {
            const y = padTop + mainChartH - (t / max) * mainChartH;
            return (
              <g key={`mt-${t}`}>
                <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                <text x={padX - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{t}</text>
              </g>
            );
          })}

          {/* Main area fill */}
          <defs>
            <linearGradient id="mainGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="30%" stopColor="#3b82f6" />
              <stop offset="70%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d={`${mainPath} L ${mainPoints[mainPoints.length - 1].x} ${padTop + mainChartH} L ${mainPoints[0].x} ${padTop + mainChartH} Z`}
            fill="url(#mainGrad)" opacity={0.1}
          />
          <path d={mainPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Main dots */}
          {mainPoints.map((p) => (
            <g key={p.status} onClick={() => setSelected(isSelected(p.status) ? null : { status: p.status })} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={isSelected(p.status) ? 8 : 6} fill={DOT_COLORS[p.status] ?? "#94a3b8"} stroke="white" strokeWidth={2} />
              {p.count > 0 && <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={11} fill="#1e293b" fontWeight={600}>{p.count}</text>}
              <text x={p.x} y={padTop + mainChartH + 16} textAnchor="middle" fontSize={10} fill="#64748b">{p.label}</text>
            </g>
          ))}

          {/* Terminal lines */}
          {terminalData.map((tl) => (
            <g key={tl.status}>
              {/* Label */}
              <text x={padX - 8} y={tl.baseY + tl.innerH / 2 + 4} textAnchor="end" fontSize={10} fill={tl.color} fontWeight={600}>{tl.label}</text>
              {/* Baseline */}
              <line x1={tl.points[0].x} y1={tl.baseY + tl.innerH} x2={tl.points[tl.points.length - 1].x} y2={tl.baseY + tl.innerH} stroke="#f1f5f9" strokeWidth={1} />
              {/* Line */}
              <path d={tl.path} fill="none" stroke={tl.color} strokeWidth={2} strokeLinejoin="round" opacity={0.7} />
              {/* Dots */}
              {tl.points.map((p) => (
                <g key={`${tl.status}-${p.stage}`} onClick={() => setSelected(isSelected(tl.status, p.stage) ? null : { status: tl.status, stage: p.stage })} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={isSelected(tl.status, p.stage) ? 7 : 5} fill={tl.color} stroke="white" strokeWidth={1.5} />
                  {p.count > 0 && <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={10} fill={tl.color} fontWeight={600}>{p.count}</text>}
                </g>
              ))}
            </g>
          ))}
        </svg>

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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS, STATUS_COLORS } from "@/lib/status";

const PIPELINE = ["saved", "applying", "applied", "interview", "onsite", "offer", "accepted"];
const TERMINAL = ["rejected", "declined", "withdrawn", "abandoned", "closed"];
const ALL_STAGES = [...PIPELINE, ...TERMINAL];

const DOT_COLORS: Record<string, string> = {
  saved: "#94a3b8",
  applying: "#f59e0b",
  applied: "#3b82f6",
  interview: "#10b981",
  onsite: "#14b8a6",
  offer: "#8b5cf6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  declined: "#f97316",
  withdrawn: "#94a3b8",
  abandoned: "#78716c",
  closed: "#9ca3af",
};

export function JobsFunnel() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs?sort=created_at&order=desc")
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Loading...</p>;

  const counts: Record<string, number> = {};
  for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1;

  const stages = ALL_STAGES
    .map((status) => ({
      status,
      label: STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status,
      count: counts[status] ?? 0,
    }))
    .filter((s) => PIPELINE.includes(s.status) || s.count > 0);

  const max = Math.max(...stages.map((s) => s.count), 1);

  // SVG dimensions
  const W = 700;
  const H = 200;
  const padX = 40;
  const padTop = 20;
  const padBot = 40;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBot;

  const points = stages.map((s, i) => ({
    ...s,
    x: padX + (stages.length > 1 ? (i / (stages.length - 1)) * chartW : chartW / 2),
    y: padTop + chartH - (s.count / max) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Y-axis ticks
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  const selectedJobs = selected ? jobs.filter((j) => j.status === selected) : [];
  const selectedLabel = selected ? stages.find((s) => s.status === selected)?.label : "";

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Application Pipeline</h2>
        <p className="mb-4 text-xs text-slate-400">{jobs.length} total jobs tracked</p>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
          {/* Grid lines */}
          {ticks.map((t) => {
            const y = padTop + chartH - (t / max) * chartH;
            return (
              <g key={t}>
                <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                <text x={padX - 8} y={y + 4} textAnchor="end" className="text-[10px]" fill="#94a3b8">{t}</text>
              </g>
            );
          })}

          {/* Area fill */}
          <path
            d={`${linePath} L ${points[points.length - 1]?.x ?? padX} ${padTop + chartH} L ${points[0]?.x ?? padX} ${padTop + chartH} Z`}
            fill="url(#areaGrad)"
            opacity={0.15}
          />
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="40%" stopColor="#3b82f6" />
              <stop offset="70%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          {/* Line */}
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Dots and labels */}
          {points.map((p) => (
            <g
              key={p.status}
              onClick={() => setSelected(selected === p.status ? null : p.status)}
              className="cursor-pointer"
            >
              <circle cx={p.x} cy={p.y} r={selected === p.status ? 8 : 6} fill={DOT_COLORS[p.status] ?? "#94a3b8"} stroke="white" strokeWidth={2} />
              {p.count > 0 && (
                <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[11px]" fill="#1e293b" fontWeight={600}>{p.count}</text>
              )}
              <text x={p.x} y={padTop + chartH + 16} textAnchor="middle" className="text-[10px]" fill="#64748b">{p.label}</text>
            </g>
          ))}
        </svg>

        {/* Selected stage jobs */}
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

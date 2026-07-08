"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS, STATUS_DOT_COLORS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/Stack";

const PIPELINE = ["saved", "applying", "applied", "interview", "interview2", "onsite", "offer", "accepted"];
const TERMINAL_LINES = [
  { status: "rejected", label: "Rejected", color: STATUS_DOT_COLORS.rejected, stages: ["applied", "interview", "interview2", "onsite"] },
  { status: "abandoned", label: "Abandoned", color: STATUS_DOT_COLORS.abandoned, stages: ["saved", "applying", "applied", "interview", "interview2", "onsite", "offer"] },
  { status: "closed", label: "Closed", color: STATUS_DOT_COLORS.closed, stages: ["saved", "applying", "applied", "interview", "interview2", "onsite", "offer"] },
];

const DOT_COLORS: Record<string, string> = { total: "#1e293b", ...STATUS_DOT_COLORS };

// The 5 gates shown per job row in the selected-jobs list — a simplified
// view of the pipeline (skips "applying", stops at Onsite since Offer/
// Accepted are rare terminal-ish states better read from the status pill).
const GATES = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Recruiter" },
  { key: "interview2", label: "Interview" },
  { key: "onsite", label: "Onsite" },
];

function labelFor(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

/** How many of the 5 GATES a job has reached, based on its furthest pipeline
 * stage — for terminal statuses (rejected/withdrawn/etc.), that's wherever
 * previous_status left off, matching the terminal-rows breakdown above. */
function gatesReached(job: JobRow): number {
  const effective = PIPELINE.includes(job.status) ? job.status : (job.previous_status ?? "saved");
  const rank = PIPELINE.indexOf(effective);
  if (rank === -1) return 0;
  return GATES.filter((g) => PIPELINE.indexOf(g.key) <= rank).length;
}

function GateStepper({ job }: { job: JobRow }) {
  const reached = gatesReached(job);
  return (
    <HStack gap={0} className="items-center">
      {GATES.map((g, i) => (
        <HStack key={g.key} gap={0} className="items-center">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: i < reached ? STATUS_DOT_COLORS[g.key] : "#e2e8f0" }}
            title={g.label}
          />
          <Text
            type="supporting"
            className="mr-2 ml-1 whitespace-nowrap"
            style={{ color: i < reached ? STATUS_DOT_COLORS[g.key] : "#cbd5e1" }}
          >
            {g.label}
          </Text>
          {i < GATES.length - 1 && (
            <span
              className="mr-2 h-px w-4 shrink-0"
              style={{ backgroundColor: i + 1 < reached ? STATUS_DOT_COLORS[g.key] : "#e2e8f0" }}
            />
          )}
        </HStack>
      ))}
    </HStack>
  );
}

export function JobsFunnel({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState<{ status: string; stage?: string } | null>(null);

  // jobsPromise was already kicked off server-side before this component
  // mounted, so it resolves faster than a fresh client fetch would — this
  // gives an instant first paint without the client-fetch round trip.
  // Re-fetch afterward in case a job was edited elsewhere since that load.
  useEffect(() => {
    jobsPromise.then(setJobs).catch(() => {});
    fetch("/api/jobs?sort=created_at&order=desc")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => {});
  }, [jobsPromise]);

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
      <Card className="mb-6 p-6">
        <Heading level={2} className="mb-1">Application Pipeline</Heading>
        <Text type="supporting" display="block" className="mb-4">{jobs.length} total jobs tracked</Text>

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
                <div className="w-[72px] shrink-0 text-right pr-3">
                  <Text type="supporting" weight="semibold" style={{ color: tl.color }}>{tl.label}</Text>
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
                                  ? "hover:bg-slate-100"
                                  : "text-slate-200"
                            }`}
                            style={!isSel(tl.status, entry.stage) && entry.count > 0 ? { color: tl.color } : undefined}
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
                <div className="w-10 shrink-0 text-center">
                  <Text type="supporting" weight="semibold">{total}</Text>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected jobs list */}
        {selected && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <HStack gap={2} className="mb-3 items-center">
              <Text type="label" weight="semibold">{selectedLabel}</Text>
              <Badge label={selectedJobs.length} variant="neutral" />
              <Button label="Clear" variant="ghost" size="sm" onClick={() => setSelected(null)} />
            </HStack>
            {selectedJobs.length === 0 ? (
              <Text type="supporting">No jobs in this stage.</Text>
            ) : (
              <Card className="divide-y divide-slate-100">
                {selectedJobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-4 px-3 py-2 hover:bg-slate-50">
                    <div className="min-w-0 flex-1 truncate">
                      <Text weight="semibold">{j.company || "—"}</Text>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <Text type="supporting">{j.title || "—"}</Text>
                    </div>
                    <div className="hidden shrink-0 lg:block">
                      <GateStepper job={j} />
                    </div>
                    <Text type="supporting" className="shrink-0">{formatDate(j.created_at)}</Text>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

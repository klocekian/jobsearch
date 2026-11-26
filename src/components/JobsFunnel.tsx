"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { PIPELINE_STATUSES, STATUS_DOT_COLORS, STATUS_TEXT_COLORS, furthestStage, reachedStage, statusLabel } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { HStack } from "@/components/ui/Stack";
import { Tooltip } from "@/components/ui/Tooltip";

// One dot per job, laid out left to right along the pipeline. A job still in
// play sits in its stage's column; a job that ended sits in the gap after the
// last stage it reached, since a rejection is what kept it from the next one.
const FATES = {
  here: { word: "in play", color: "var(--color-text-strong)", text: "var(--color-text-primary)" },
  rejected: { word: "rejected", color: STATUS_DOT_COLORS.rejected, text: STATUS_TEXT_COLORS.rejected },
  other: { word: "dropped", color: "light-dark(#cfcfcf, #5c5c5c)", text: "var(--color-text-secondary)" },
} as const;
type Fate = keyof typeof FATES;

/** A selection: everyone who reached a stage, or one fate at or after a stage (all stages when `stage` is unset). */
type Selection = { row: "reached" | Fate; stage?: string };

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

/** How many of the 5 GATES a job has reached, based on its furthest pipeline
 * stage — for terminal statuses (rejected/withdrawn/etc.), that's wherever
 * previous_status left off, matching the terminal-rows breakdown above. */
function gatesReached(job: JobRow): number {
  return GATES.filter((g) => reachedStage(job, g.key)).length;
}

function GateStepper({ job }: { job: JobRow }) {
  const reached = gatesReached(job);
  return (
    <HStack gap={0} className="items-center">
      {GATES.map((g, i) => (
        <HStack key={g.key} gap={0} className="items-center">
          <Tooltip content={g.label}>
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: i < reached ? STATUS_DOT_COLORS[g.key] : "var(--color-border-strong, #cbd5e1)" }}
            />
          </Tooltip>
          <Text
            type="supporting"
            className="mr-2 ml-1 whitespace-nowrap"
            style={{ color: i < reached ? STATUS_TEXT_COLORS[g.key] : "var(--color-text-secondary)" }}
          >
            {g.label}
          </Text>
          {i < GATES.length - 1 && (
            <span
              className="mr-2 h-px w-4 shrink-0"
              style={{ backgroundColor: i + 1 < reached ? STATUS_DOT_COLORS[g.key] : "var(--color-border, #e2e8f0)" }}
            />
          )}
        </HStack>
      ))}
    </HStack>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

/** A clickable count, e.g. "29 rejected", in its fate's color. */
function FateCount({ n, word, color, selected, onClick, label }: { n: number; word?: string; color: string; selected: boolean; onClick: () => void; label: string }) {
  if (n === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`whitespace-nowrap rounded px-1 text-[12px] tabular-nums transition ${selected ? "bg-[var(--color-background-inverted)] text-[var(--color-background-body)]" : "hover:bg-muted"}`}
      style={selected ? undefined : { color }}
    >
      <span className="font-semibold">{n}</span>{word && ` ${word}`}
    </button>
  );
}

// Dots stack in rows of five, so they count like tally marks.
const PER_ROW = 5;

/** A column of job dots, filled from the bottom. Past `max` it shows the newest and says how many more. */
function DotStack({ groups, max, align = "center" }: { groups: { fate: Fate; jobs: JobRow[] }[]; max: number; align?: "start" | "center" }) {
  const all = groups.flatMap((g) => [...g.jobs].sort((x, y) => y.created_at.localeCompare(x.created_at)).map((job) => ({ job, color: FATES[g.fate].color })));
  const shown = all.slice(0, max);
  const rows: (typeof shown)[] = [];
  for (let i = 0; i < shown.length; i += PER_ROW) rows.push(shown.slice(i, i + PER_ROW));
  return (
    <div className={`flex flex-col-reverse items-start gap-[2px] self-end ${align === "start" ? "justify-self-start" : "justify-self-center"}`} style={{ width: PER_ROW * 9 - 2 }}>
      {rows.map((row, r) => (
        <div key={r} className="flex gap-[2px]">
          {row.map(({ job, color }) => (
            <Tooltip key={job.id} content={`${job.company || "—"} · ${job.title || "—"}`}>
              <Link href={`/jobs/${job.id}`} aria-label={`${job.company || "Untitled"}, ${statusLabel(job.status)}`} className="block h-[7px] w-[7px] shrink-0 rounded-full transition-transform hover:scale-150" style={{ backgroundColor: color }} />
            </Tooltip>
          ))}
        </div>
      ))}
      {all.length > shown.length && <span className="mb-0.5 whitespace-nowrap text-[11px] tabular-nums text-secondary">+{all.length - shown.length} more</span>}
    </div>
  );
}

export function JobsFunnel({ jobs }: { jobs: JobRow[] }) {
  const [selected, setSelected] = useState<Selection | null>(null);

  const stages = PIPELINE_STATUSES.map((stage) => {
    const stopped = jobs.filter((j) => !PIPELINE_STATUSES.includes(j.status) && furthestStage(j) === stage);
    return {
      stage,
      label: statusLabel(stage),
      reached: jobs.filter((j) => reachedStage(j, stage)).length,
      here: jobs.filter((j) => j.status === stage),
      rejected: stopped.filter((j) => j.status === "rejected"),
      other: stopped.filter((j) => j.status !== "rejected"),
    };
  });
  const totals = { here: 0, rejected: 0, other: 0 };
  for (const s of stages) for (const f of ["here", "rejected", "other"] as const) totals[f] += s[f].length;

  // Selected jobs
  let selectedJobs: JobRow[] = [];
  let selectedLabel = "";
  if (selected) {
    const { row, stage } = selected;
    const i = stage ? PIPELINE_STATUSES.indexOf(stage) : -1;
    const next = PIPELINE_STATUSES[i + 1];
    const between = stage && next ? ` between ${statusLabel(stage)} and ${statusLabel(next)}` : stage ? ` after ${statusLabel(stage)}` : "";
    const s = stages[i];
    if (row === "reached" && stage) {
      selectedJobs = jobs.filter((j) => reachedStage(j, stage));
      selectedLabel = `Reached ${statusLabel(stage)}`;
    } else if (row === "here") {
      selectedJobs = s ? s.here : stages.flatMap((x) => x.here);
      selectedLabel = s ? `In play at ${s.label}` : "In play";
    } else {
      const fate = row as "rejected" | "other";
      selectedJobs = s ? s[fate] : stages.flatMap((x) => x[fate]);
      selectedLabel = `${fate === "rejected" ? "Rejected" : "Dropped"}${between}`;
    }
  }

  const isSel = (row: Selection["row"], stage?: string) => selected?.row === row && selected?.stage === stage;
  const toggle = (row: Selection["row"], stage?: string) => setSelected(isSel(row, stage) ? null : { row, stage });
  // Saved can run to hundreds, so it's cut off at the height of the tallest
  // other column (at least 8 rows, at most 20) rather than dwarfing the rest.
  const tallest = Math.max(...stages.slice(1).map((s) => s.here.length), ...stages.map((s) => s.rejected.length + s.other.length));
  const savedMax = PER_ROW * Math.min(20, Math.max(8, Math.ceil(tallest / PER_ROW)));
  // Stage columns alternate with narrower gap columns; the last stage has no gap after it.
  const columns = stages.map((_, i) => (i < stages.length - 1 ? "minmax(0, 2fr) minmax(44px, 0.8fr)" : "minmax(0, 2fr)")).join(" ");

  return (
    <div>
      <Card className="p-4 sm:p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <Heading level={3}>Application pipeline</Heading>
          <Text type="supporting" color="secondary">{jobs.length} jobs tracked</Text>
        </div>
        <Text as="p" type="supporting" color="secondary" className="mb-4">
          Each dot is a job. <Swatch color={FATES.here.color} />
          <FateCount n={totals.here} word="in play" color={FATES.here.text} selected={isSel("here")} onClick={() => toggle("here")} label={`${totals.here} in play`} /> sit at their stage; the rest stopped in the gap before the next one:{" "}
          <Swatch color={FATES.rejected.color} />
          <FateCount n={totals.rejected} word="rejected" color={FATES.rejected.text} selected={isSel("rejected")} onClick={() => toggle("rejected")} label={`${totals.rejected} rejected`} />{" "}
          <Swatch color={FATES.other.color} />
          <FateCount n={totals.other} word="dropped" color={FATES.other.text} selected={isSel("other")} onClick={() => toggle("other")} label={`${totals.other} dropped`} />
        </Text>

        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] items-end" style={{ gridTemplateColumns: columns, columnGap: 4 }}>
            {/* Dots */}
            {stages.map((s, i) => (
              <div key={s.stage} className="contents">
                <DotStack groups={[{ fate: "here", jobs: s.here }]} max={i === 0 ? savedMax : PER_ROW * 20} align={i === 0 ? "start" : "center"} />
                {i < stages.length - 1 && <DotStack groups={[{ fate: "rejected", jobs: s.rejected }, { fate: "other", jobs: s.other }]} max={PER_ROW * 20} />}
              </div>
            ))}

            <div className="col-span-full mt-1.5 border-t border-border" />

            {/* Labels: stage name, how many reached it, how many are there now; gap counts */}
            {stages.map((s, i) => (
              <div key={s.stage} className="contents">
                {/* The first column hugs the left edge so its labels never clip there */}
                <div className={`flex flex-col self-start pt-1.5 ${i === 0 ? "items-start text-left" : "items-center text-center"}`}>
                  <button
                    type="button"
                    onClick={() => toggle("reached", s.stage)}
                    aria-pressed={isSel("reached", s.stage)}
                    className={`rounded px-1 leading-tight transition ${isSel("reached", s.stage) ? "bg-muted" : "hover:bg-muted"}`}
                  >
                    <Text type="supporting" weight="semibold" display="block" className="whitespace-nowrap">{s.label}</Text>
                  </button>
                  <FateCount n={s.here.length} word="in play" color={FATES.here.text} selected={isSel("here", s.stage)} onClick={() => toggle("here", s.stage)} label={`${s.here.length} in play at ${s.label}`} />
                  <span className="whitespace-nowrap text-[11px] tabular-nums text-secondary">{s.reached} reached</span>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center self-start pt-1.5 text-center">
                    <FateCount n={s.rejected.length} color={FATES.rejected.text} selected={isSel("rejected", s.stage)} onClick={() => toggle("rejected", s.stage)} label={`${s.rejected.length} rejected after ${s.label}`} />
                    {s.other.length > 0 && (
                      <Tooltip content={s.other.map((j) => statusLabel(j.status).toLowerCase()).sort().join(", ")}>
                        <span>
                          <FateCount n={s.other.length} color={FATES.other.text} selected={isSel("other", s.stage)} onClick={() => toggle("other", s.stage)} label={`${s.other.length} dropped after ${s.label}`} />
                        </span>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selected jobs list */}
        {selected && (
          <div className="mt-4 border-t border-border pt-4">
            <HStack gap={2} className="mb-3 items-center">
              <Text type="label" weight="semibold">{selectedLabel}</Text>
              <Badge label={selectedJobs.length} variant="neutral" />
              <Button label="Clear" variant="ghost" size="sm" onClick={() => setSelected(null)} />
            </HStack>
            {selectedJobs.length === 0 ? (
              <Text type="supporting">No jobs in this stage.</Text>
            ) : (
              <Card className="divide-y divide-border">
                {selectedJobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-4 px-3 py-2 hover:bg-muted transition-colors">
                    <div className="min-w-0 flex-1 truncate">
                      <Text weight="semibold">{j.company || "—"}</Text>
                      <span className="mx-1.5 text-secondary">·</span>
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

"use client";

import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import type { AnalysisRunMeta } from "@/lib/db/analysis-runs";

/** Run timestamps are ISO, except runs carried over from before history (SQLite UTC, no zone). */
export function runDate(createdAt: string): Date {
  const iso = /[TZ]/.test(createdAt) ? createdAt : `${createdAt.replace(" ", "T")}Z`;
  return new Date(iso);
}

function shortWhen(createdAt: string): string {
  return runDate(createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Rule-based", "AI · claude", "Claude via MCP", or the resume a match ran against. */
export function runMethodLabel(run: Pick<AnalysisRunMeta, "kind" | "method" | "resume_name">): string {
  if (run.kind === "match") return run.resume_name || "ATS match";
  if (!run.method) return "Earlier run";
  if (run.method.startsWith("deterministic")) return "Rule-based";
  if (run.method.startsWith("mcp:")) return "Claude via MCP";
  return `AI · ${run.method.split(":")[0]}`;
}

/**
 * Picker over every saved run of one analysis. Choosing an older run shows
 * its report; "Make current" puts it back on the job (score in the jobs
 * table, tab label) without re-running anything.
 */
export function RunHistory({
  runs,
  currentRunId,
  viewingRunId,
  outOf,
  onView,
  onMakeCurrent,
  busy,
}: {
  runs: AnalysisRunMeta[];
  currentRunId: number | null;
  /** null means the current run is showing. */
  viewingRunId: number | null;
  outOf: number;
  onView: (runId: number | null) => void;
  onMakeCurrent: (runId: number) => void;
  busy?: boolean;
}) {
  if (runs.length === 0) return null;
  const shownId = viewingRunId ?? currentRunId ?? runs[0].id;
  const viewingOld = viewingRunId != null && viewingRunId !== currentRunId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Selector
        label="Run history"
        isLabelHidden
        className="max-w-[320px]"
        value={String(shownId)}
        onChange={(v) => {
          const id = Number(v);
          onView(id === currentRunId ? null : id);
        }}
        options={runs.map((r) => ({
          value: String(r.id),
          label: `${shortWhen(r.created_at)} · ${r.score ?? "–"}/${outOf} · ${runMethodLabel(r)}${r.id === currentRunId ? " (current)" : ""}`,
        }))}
      />
      <span className="text-xs text-secondary">
        {runs.length} run{runs.length === 1 ? "" : "s"} saved
      </span>
      {viewingOld && (
        <>
          <Button label={busy ? "Saving…" : "Make current"} variant="secondary" size="sm" onClick={() => onMakeCurrent(viewingRunId!)} isDisabled={busy} />
          <Button label="Back to current" variant="ghost" size="sm" onClick={() => onView(null)} />
        </>
      )}
    </div>
  );
}

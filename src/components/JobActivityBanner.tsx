"use client";

import { useMemo, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import type { SubmissionRow } from "@/lib/db/submissions";
import { STATUS_COLORS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { apiSend, errorMessage } from "@/lib/api-client";
import { formatEventWhen, relativeDay, resolveJobActivity, statusLabel } from "@/lib/job-activity";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";

const COLLAPSED_KEY = "jobActivityBannerCollapsed";

const SOURCE_LABELS = {
  mcp: "Summary from Claude (MCP)",
  ai: "AI summary",
  derived: "From your notes and job signals",
} as const;

/**
 * Where this job stands: stage, the next scheduled event, the latest
 * interaction, and next steps. Content comes from the stored MCP/AI summary
 * when it's current, otherwise it's derived from the notes — see
 * lib/job-activity.ts.
 */
export function JobActivityBanner({
  job,
  submissions,
  onJobUpdated,
  defaultCollapsed = false,
}: {
  job: JobRow;
  submissions: SubmissionRow[];
  onJobUpdated: (job: JobRow) => void;
  /** Used until the user toggles it; after that their choice sticks. */
  defaultCollapsed?: boolean;
}) {
  const activity = useMemo(() => resolveJobActivity(job, submissions), [job, submissions]);
  const [collapsed, setCollapsed] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(COLLAPSED_KEY) : null;
    return stored ? stored === "1" : defaultCollapsed;
  });
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  };

  const summarize = async () => {
    setSummarizing(true);
    setError(null);
    try {
      const d = await apiSend<{ job: JobRow }>(`/api/jobs/${job.id}/activity-summary`, "POST");
      onJobUpdated(d.job);
    } catch (err) {
      setError(errorMessage(err, "Could not summarize — no response from the server."));
    } finally {
      setSummarizing(false);
    }
  };

  const next = activity.upcoming[0];
  const hasDetail = activity.upcoming.length > 0 || activity.latest || activity.next_steps.length > 0;

  return (
    <section
      aria-label="Job activity"
      className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-px shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[job.status] ?? STATUS_COLORS.saved}`}
        >
          {statusLabel(job.status)}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug text-primary">
          {activity.headline}
          {collapsed && next && (
            <span className="text-secondary"> · {formatEventWhen(next)}</span>
          )}
        </p>
        {hasDetail && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Show activity details" : "Hide activity details"}
            className="shrink-0 rounded p-0.5 text-secondary hover:bg-border/60 hover:text-primary cursor-pointer"
          >
            {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mt-2.5 space-y-2.5">
          {activity.upcoming.length > 0 && (
            <Row label="Upcoming">
              <ul className="space-y-1">
                {activity.upcoming.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium text-primary">{e.what}</span>
                    <span className="text-secondary"> — {formatEventWhen(e)}</span>
                    <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-px text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                      {relativeDay(e.when)}
                    </span>
                    {e.details && e.details !== e.what && activity.source !== "derived" && (
                      <span className="block text-secondary">{e.details}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Row>
          )}

          {activity.latest && (
            <Row label={activity.latest.date ? `Latest · ${formatDate(activity.latest.date)}` : "Latest"}>
              <span className="text-primary">{activity.latest.summary}</span>
            </Row>
          )}

          {activity.next_steps.length > 0 && (
            <Row label="Next steps">
              <ul className="list-disc space-y-0.5 pl-4 text-primary marker:text-secondary">
                {activity.next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Row>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-secondary">
              {SOURCE_LABELS[activity.source]}
              {activity.source !== "derived" && activity.written_at && <> · {formatDate(activity.written_at)}</>}
              {activity.stale && <> · notes changed since the last summary</>}
            </span>
            <div className="flex items-center gap-2">
              {error && <span className="text-rose-700 dark:text-rose-400">{error}</span>}
              {job.notes?.trim() && (
                <button
                  type="button"
                  onClick={summarize}
                  disabled={summarizing}
                  className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-border/60 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                >
                  {summarizing ? "Summarizing…" : activity.source === "derived" ? "Summarize with AI" : "Refresh"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 leading-relaxed">
      <span className="font-medium text-secondary">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

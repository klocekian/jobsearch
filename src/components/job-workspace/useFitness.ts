import { useCallback, useMemo, useState } from "react";
import { apiSend, errorMessage } from "@/lib/api-client";
import { renderFitnessText } from "@/lib/fitness/render";
import type { FitnessResult } from "@/lib/fitness/schema";
import type { AnalysisRunMeta, AnalysisRunRow } from "@/lib/db/analysis-runs";
import type { JobRow } from "@/lib/db/jobs";
import { runDate } from "../RunHistory";

interface UseFitnessArgs {
  jobId: number;
  job: JobRow | null;
  setJob: (job: JobRow) => void;
  updateJob: (fields: Partial<JobRow>) => Promise<JobRow>;
  refetchJob: () => Promise<void>;
  runs: AnalysisRunMeta[];
  refetchRuns: () => Promise<void>;
  getRun: (runId: number) => Promise<AnalysisRunRow>;
  makeCurrent: (runId: number) => Promise<JobRow>;
  onRestoreError: (message: string) => void;
}

/**
 * The job's fitness check: the saved report, running a new one, viewing or
 * restoring an older run, and writing a report into the notes.
 */
export function useFitness({
  jobId, job, setJob, updateJob, refetchJob, runs, refetchRuns, getRun, makeCurrent, onRestoreError,
}: UseFitnessArgs) {
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesFlash, setNotesFlash] = useState(false);
  // Derived, not stored: the job row is the source of truth for a saved
  // report, so a re-fetch after saving updates this with no extra state.
  const reportJson = job?.fitness_report ?? null;
  const saved = useMemo<FitnessResult | null>(() => {
    if (!reportJson) return null;
    try { return JSON.parse(reportJson) as FitnessResult; } catch { return null; }
  }, [reportJson]);
  // The older run being viewed, if any.
  const [viewed, setViewed] = useState<{ id: number; result: FitnessResult; runAt: string; method: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  // What the tab shows: the viewed older run if one is picked, else the current one.
  const shown = viewed?.result ?? saved;
  const shownRunAt = viewed?.runAt ?? job?.fitness_run_at ?? null;
  const shownMethod = viewed
    ? viewed.method
    : runs.find((r) => r.id === job?.fitness_run_id)?.method ?? "";

  const run = useCallback(async (useAi = false) => {
    if (!job || !job.posting_text.trim()) return;
    setRunning(true);
    setError(null);
    setNotesFlash(false);
    try {
      // The route saves the run itself and returns the updated job.
      const data = await apiSend<{ result?: FitnessResult; job?: JobRow }>(
        "/api/fitness-check", "POST", { job_id: jobId, use_ai: useAi },
      );
      if (!data.result) {
        setError("Fitness check failed.");
        return;
      }
      setViewed(null);
      if (data.job) setJob(data.job);
      else await refetchJob();
      await refetchRuns();
    } catch (err) {
      setError(errorMessage(err, "Fitness check failed."));
    } finally {
      setRunning(false);
    }
  }, [job, jobId, refetchJob, refetchRuns, setJob]);

  /**
   * Writing the report into the job's notes, and abandoning the job, stay
   * behind explicit presses. Persisting the report is bookkeeping; these two
   * are decisions, and automating a decision is how you stop reading the
   * report that informs it.
   */
  const addToNotes = async (alsoAbandon: boolean) => {
    if (!job || !shown) return;
    setSaving(true);
    const stamp = shownRunAt ? runDate(shownRunAt).toLocaleString() : new Date().toLocaleString();
    const header = `--- Fitness check · ${stamp}` +
      `${shownMethod ? ` · ${shownMethod}` : ""} ---`;
    const body = [header, renderFitnessText(shown)].filter(Boolean).join("\n");
    const notes = job.notes?.trim() ? `${body}\n\n${job.notes}` : body;
    try {
      await updateJob({ notes, ...(alsoAbandon ? { status: "abandoned" } : {}) });
      setError(null);
      setNotesFlash(true);
    } catch (err) {
      setError(errorMessage(err, "Could not write to notes — no response from the server."));
    } finally {
      setSaving(false);
    }
  };

  const view = useCallback(async (runId: number | null) => {
    if (runId == null) {
      setViewed(null);
      return;
    }
    const r = await getRun(runId).catch(() => null);
    if (!r) return;
    try {
      setViewed({ id: r.id, result: JSON.parse(r.report) as FitnessResult, runAt: r.created_at, method: r.method });
    } catch { /* unreadable report — stay on the current one */ }
  }, [getRun]);

  const restore = useCallback(async (runId: number) => {
    setRestoring(true);
    try {
      setJob(await makeCurrent(runId));
      setViewed(null);
    } catch (err) {
      onRestoreError(errorMessage(err, "Could not restore that run."));
    } finally {
      setRestoring(false);
    }
  }, [makeCurrent, setJob, onRestoreError]);

  return {
    saved, shown, shownRunAt, shownMethod, viewed,
    running, saving, error, setError, notesFlash, restoring,
    run, addToNotes, view, restore,
  };
}

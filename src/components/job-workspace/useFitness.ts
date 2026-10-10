import { useCallback, useMemo, useState } from "react";
import { apiSend, errorMessage } from "@/lib/api-client";
import { renderFitnessText } from "@/lib/fitness/render";
import type { FitnessResult } from "@/lib/fitness/schema";
import type { JobRow } from "@/lib/db/jobs";

interface UseFitnessArgs {
  jobId: number;
  job: JobRow | null;
  setJob: (job: JobRow) => void;
  updateJob: (fields: Partial<JobRow>) => Promise<JobRow>;
  refetchJob: () => Promise<void>;
}

/** "Rule-based", "AI · claude", or "Claude via MCP", from the model the fitness route reports. */
function methodLabel(model: string): string {
  if (model.startsWith("deterministic")) return "Rule-based";
  if (model.startsWith("mcp:")) return "Claude via MCP";
  return `AI · ${model.split(":")[0]}`;
}

/**
 * The job's fitness check: the saved report, running a new one, and writing
 * a report into the notes.
 */
export function useFitness({ jobId, job, setJob, updateJob, refetchJob }: UseFitnessArgs) {
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
  const runAt = job?.fitness_run_at ?? null;
  // Which method produced the report, known only for a run made in this session.
  const [method, setMethod] = useState<string | null>(null);

  const run = useCallback(async (useAi = false) => {
    if (!job || !job.posting_text.trim()) return;
    setRunning(true);
    setError(null);
    setNotesFlash(false);
    try {
      // The route saves the run itself and returns the updated job.
      const data = await apiSend<{ result?: FitnessResult; model?: string; job?: JobRow }>(
        "/api/fitness-check", "POST", { job_id: jobId, use_ai: useAi },
      );
      if (!data.result) {
        setError("Fitness check failed.");
        return;
      }
      setMethod(data.model ? methodLabel(data.model) : null);
      if (data.job) setJob(data.job);
      else await refetchJob();
    } catch (err) {
      setError(errorMessage(err, "Fitness check failed."));
    } finally {
      setRunning(false);
    }
  }, [job, jobId, refetchJob, setJob]);

  /**
   * Writing the report into the job's notes, and abandoning the job, stay
   * behind explicit presses. Persisting the report is bookkeeping; these two
   * are decisions, and automating a decision is how you stop reading the
   * report that informs it.
   */
  const addToNotes = async (alsoAbandon: boolean) => {
    if (!job || !saved) return;
    setSaving(true);
    const stamp = runAt ? new Date(runAt).toLocaleString() : new Date().toLocaleString();
    const header = `--- Fitness check · ${stamp}` +
      `${method ? ` · ${method}` : ""} ---`;
    const body = [header, renderFitnessText(saved)].filter(Boolean).join("\n");
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

  return {
    saved, runAt, method,
    running, saving, error, setError, notesFlash,
    run, addToNotes,
  };
}

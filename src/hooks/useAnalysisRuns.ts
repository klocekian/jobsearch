import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api-client";
import type { AnalysisRunMeta, AnalysisRunRow } from "@/lib/db/analysis-runs";
import type { JobRow } from "@/lib/db/jobs";

export type RunKind = "fitness" | "match";
export type AnalysisRuns = Record<RunKind, AnalysisRunMeta[]>;

/** A job's saved fitness and match run history (metadata only), most recent first. */
export function useAnalysisRuns(jobId: number) {
  const [runs, setRuns] = useState<AnalysisRuns>({ fitness: [], match: [] });

  useEffect(() => {
    let ignore = false;
    apiGet<AnalysisRuns>(`/api/jobs/${jobId}/analysis-runs`)
      .then((d) => { if (!ignore) setRuns(d); })
      .catch(() => {});
    return () => { ignore = true; };
  }, [jobId]);

  // History is secondary to the run that just happened, so a failed reload is ignored.
  const refetch = useCallback(async () => {
    try {
      setRuns(await apiGet<AnalysisRuns>(`/api/jobs/${jobId}/analysis-runs`));
    } catch {
      // keep current history
    }
  }, [jobId]);

  /** One run with its full report. Throws ApiError on failure. */
  const getRun = useCallback(async (runId: number): Promise<AnalysisRunRow> => {
    const { run } = await apiGet<{ run: AnalysisRunRow }>(`/api/jobs/${jobId}/analysis-runs/${runId}`);
    return run;
  }, [jobId]);

  /** Make an older run the job's current one; returns the updated job. Throws ApiError on failure. */
  const makeCurrent = useCallback(async (runId: number): Promise<JobRow> => {
    const { job } = await apiSend<{ job: JobRow }>(`/api/jobs/${jobId}/analysis-runs/${runId}`, "POST");
    return job;
  }, [jobId]);

  return { runs, refetch, getRun, makeCurrent };
}

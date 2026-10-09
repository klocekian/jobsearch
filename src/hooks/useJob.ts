import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api-client";
import type { JobRow } from "@/lib/db/jobs";
import type { SubmissionRow } from "@/lib/db/submissions";

interface JobResponse {
  job: JobRow;
  submissions: SubmissionRow[];
}

/** A job and its submissions, loaded from /api/jobs/:id. `job` stays null when it doesn't exist. */
export function useJob(jobId: number) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    apiGet<JobResponse>(`/api/jobs/${jobId}`)
      .then((data) => {
        if (ignore) return;
        setJob(data.job);
        setSubmissions(data.submissions);
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [jobId]);

  // A failed refresh keeps showing what we already have; the write that
  // preceded it is what reports errors.
  const refetch = useCallback(async () => {
    try {
      const data = await apiGet<JobResponse>(`/api/jobs/${jobId}`);
      setJob(data.job);
      setSubmissions(data.submissions);
    } catch {
      // keep current state
    }
  }, [jobId]);

  /** PATCH the job and take the updated row from the reply. Throws ApiError on failure. */
  const updateJob = useCallback(async (fields: Partial<JobRow>): Promise<JobRow> => {
    const { job: updated } = await apiSend<{ job: JobRow }>(`/api/jobs/${jobId}`, "PATCH", fields);
    setJob(updated);
    return updated;
  }, [jobId]);

  return { job, setJob, submissions, loading, refetch, updateJob };
}

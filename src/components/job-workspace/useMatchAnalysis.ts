import { useCallback, useMemo, useState } from "react";
import { analyze } from "@/lib/analysis/analyze";
import type { MatchReport } from "@/lib/analysis/types";
import { apiSend, errorMessage } from "@/lib/api-client";
import { clearCoverLetter, clearRewrite } from "@/lib/storage";
import type { AnalysisRunRow } from "@/lib/db/analysis-runs";
import type { JobRow } from "@/lib/db/jobs";
import type { ResumeRow } from "@/lib/db/resumes";

export interface MatchAnalysis {
  report: MatchReport;
  resumeText: string;
  jobText: string;
}

interface UseMatchAnalysisArgs {
  jobId: number;
  job: JobRow | null;
  setJob: (job: JobRow) => void;
  resumeText: string;
  setResumeText: (text: string) => void;
  savedResumes: ResumeRow[];
  refetchRuns: () => Promise<void>;
  getRun: (runId: number) => Promise<AnalysisRunRow>;
  makeCurrent: (runId: number) => Promise<JobRow>;
  onRestoreError: (message: string) => void;
}

/**
 * The ATS match between the picked resume and the posting: the one just run
 * here, else the one stored on the job, plus viewing/restoring older runs.
 */
export function useMatchAnalysis({
  jobId, job, setJob, resumeText, setResumeText, savedResumes, refetchRuns, getRun, makeCurrent, onRestoreError,
}: UseMatchAnalysisArgs) {
  const [userAnalysis, setUserAnalysis] = useState<MatchAnalysis | null>(null);
  const [viewed, setViewed] = useState<{ id: number; report: MatchReport; resumeText: string | null } | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Derived match report (from user trigger or stored in job row)
  const analyzed = useMemo<MatchAnalysis | null>(() => {
    if (userAnalysis) return userAnalysis;
    if (!job || !resumeText || !job.match_report || !job.posting_text) return null;
    try {
      const report = JSON.parse(job.match_report) as MatchReport;
      return { report, resumeText, jobText: job.posting_text };
    } catch {
      return null;
    }
  }, [userAnalysis, job, resumeText]);

  // What the tab shows: the viewed older run if one is picked, else the current one.
  const shown = viewed && job
    ? { report: viewed.report, resumeText: viewed.resumeText ?? resumeText, jobText: job.posting_text }
    : analyzed;

  /** Runs the match in the browser and records it. Returns false if there was nothing to run. */
  const run = useCallback((): boolean => {
    if (!job || !resumeText.trim() || !job.posting_text.trim()) return false;
    if (!analyzed || analyzed.jobText !== job.posting_text) {
      clearCoverLetter();
      clearRewrite();
    }
    const report = analyze({
      resumeText, jobText: job.posting_text,
      company: job.company, jobTitle: job.title, jobUrl: job.url, fileName: "",
    });
    setUserAnalysis({ report, resumeText, jobText: job.posting_text });
    setViewed(null);
    const selectedResume = savedResumes.find(r => r.content === resumeText);
    apiSend<{ job?: JobRow }>(`/api/jobs/${jobId}/analysis-runs`, "POST", {
      kind: "match",
      report,
      // Record which resume produced the score, so the ATS number reads as a
      // fact about a document rather than a verdict on the job.
      resume_name: selectedResume?.name ?? null,
      resume_text: resumeText,
    })
      .then((d) => {
        if (d?.job) setJob(d.job);
        refetchRuns();
      })
      .catch(() => {});
    if (selectedResume && job.company) {
      apiSend(`/api/resumes/${selectedResume.id}`, "PATCH", { add_tag: job.company }).catch(() => {});
    }
    return true;
  }, [job, resumeText, analyzed, savedResumes, jobId, refetchRuns, setJob]);

  const view = useCallback(async (runId: number | null) => {
    if (runId == null) {
      setViewed(null);
      return;
    }
    const r = await getRun(runId).catch(() => null);
    if (!r) return;
    try {
      setViewed({ id: r.id, report: JSON.parse(r.report) as MatchReport, resumeText: r.resume_text });
    } catch { /* unreadable report — stay on the current one */ }
  }, [getRun]);

  const restore = useCallback(async (runId: number) => {
    setRestoring(true);
    try {
      setJob(await makeCurrent(runId));
      // The restored report is about the resume it ran against — show that one.
      if (viewed?.id === runId && viewed.resumeText) setResumeText(viewed.resumeText);
      setViewed(null);
      setUserAnalysis(null);
    } catch (err) {
      onRestoreError(errorMessage(err, "Could not restore that run."));
    } finally {
      setRestoring(false);
    }
  }, [makeCurrent, setJob, setResumeText, viewed, onRestoreError]);

  return { analyzed, shown, viewed, restoring, run, view, restore };
}

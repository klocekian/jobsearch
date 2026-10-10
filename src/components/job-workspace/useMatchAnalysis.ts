import { useCallback, useMemo, useState } from "react";
import { analyze } from "@/lib/analysis/analyze";
import type { MatchReport } from "@/lib/analysis/types";
import { apiSend } from "@/lib/api-client";
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
  savedResumes: ResumeRow[];
}

/**
 * The ATS match between the picked resume and the posting: the one just run
 * here, else the one stored on the job.
 */
export function useMatchAnalysis({ jobId, job, setJob, resumeText, savedResumes }: UseMatchAnalysisArgs) {
  const [userAnalysis, setUserAnalysis] = useState<MatchAnalysis | null>(null);

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

  /** Runs the match in the browser and records it. Returns false if there was nothing to run. */
  const run = useCallback((): boolean => {
    if (!job || !resumeText.trim() || !job.posting_text.trim()) return false;
    const report = analyze({
      resumeText, jobText: job.posting_text,
      company: job.company, jobTitle: job.title, jobUrl: job.url, fileName: "",
    });
    setUserAnalysis({ report, resumeText, jobText: job.posting_text });
    const selectedResume = savedResumes.find(r => r.content === resumeText);
    apiSend<{ job?: JobRow }>(`/api/jobs/${jobId}/match`, "POST", {
      report,
      // Record which resume produced the score, so the ATS number reads as a
      // fact about a document rather than a verdict on the job.
      resume_name: selectedResume?.name ?? null,
    })
      .then((d) => { if (d?.job) setJob(d.job); })
      .catch(() => {});
    if (selectedResume && job.company) {
      apiSend(`/api/resumes/${selectedResume.id}`, "PATCH", { add_tag: job.company }).catch(() => {});
    }
    return true;
  }, [job, resumeText, savedResumes, jobId, setJob]);

  return { analyzed, run };
}

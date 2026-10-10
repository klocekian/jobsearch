"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import type { ResumeRow } from "@/lib/db/resumes";
import { MatchReportView, type AiDetectionState } from "../MatchReportView";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { ResumePicker } from "./ResumePicker";
import { WithAiToggle } from "./WithAiToggle";
import type { useMatchAnalysis } from "./useMatchAnalysis";

interface MatchTabProps {
  job: JobRow;
  match: ReturnType<typeof useMatchAnalysis>;
  aiDetection: AiDetectionState;
  resumes: ResumeRow[];
  resumeText: string;
  onPickResume: (text: string) => void;
  onResumeAdded: (resume: ResumeRow) => void;
  withAi: boolean;
  onWithAiChange: (value: boolean) => void;
  analyzing: boolean;
  onAnalyze: () => void;
  /** Open the picked resume in Tools to tailor it. */
  onEdit: () => void;
}

/** Resume tab: the ATS match report for the picked resume. */
export function MatchTab({
  job, match, aiDetection, resumes, resumeText, onPickResume, onResumeAdded,
  withAi, onWithAiChange, analyzing, onAnalyze, onEdit,
}: MatchTabProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { analyzed } = match;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            label="Edit"
            variant="secondary"
            size="sm"
            onClick={onEdit}
            isDisabled={!resumeText.trim()}
          />
          <ResumePicker
            resumes={resumes}
            resumeText={resumeText}
            onPick={onPickResume}
            onAdded={onResumeAdded}
            onError={setUploadError}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            label={analyzing ? "Analyzing…" : analyzed ? "Re-run analysis" : "Analyze"}
            variant="primary"
            size="sm"
            onClick={onAnalyze}
            isDisabled={analyzing || !job.posting_text.trim() || !resumeText.trim()}
          />
          <WithAiToggle checked={withAi} onChange={onWithAiChange} />
        </div>
      </div>

      {uploadError && <Banner status="error" title={uploadError} />}

      {analyzed ? (
        <MatchReportView
          report={analyzed.report}
          aiDetection={aiDetection}
          analysisDisabled={!resumeText.trim() || !job.posting_text.trim()}
          hasAnalysis={!!analyzed}
        />
      ) : (
        <div className="py-8">
          <Banner
            status="info"
            title={job.posting_text.trim()
              ? 'Select a resume and click "Analyze" to run the ATS pass report.'
              : 'Add a job posting and click "Analyze" to see the ATS pass report.'}
          />
        </div>
      )}
    </>
  );
}

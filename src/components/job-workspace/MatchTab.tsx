"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import type { ResumeRow } from "@/lib/db/resumes";
import type { ContextMaterial } from "@/lib/context";
import { MatchReportView, type AiDetectionState } from "../MatchReportView";
import { ResumeView } from "../ResumeView";
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
  /** Showing the resume tailoring editor instead of the ATS report. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  materials: ContextMaterial[];
  onMaterialsChange: (materials: ContextMaterial[]) => void;
}

/** Resume tab: the ATS match report for the picked resume, and tailoring it. */
export function MatchTab({
  job, match, aiDetection, resumes, resumeText, onPickResume, onResumeAdded,
  withAi, onWithAiChange, analyzing, onAnalyze, editing, onEditingChange, materials, onMaterialsChange,
}: MatchTabProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { analyzed } = match;

  if (editing) {
    return analyzed ? (
      <ResumeView
        resumeText={analyzed.resumeText}
        company={job.company}
        jobText={job.posting_text}
        jobTitle={job.title}
        missingSkills={analyzed.report.highlights.missing}
        aiDetection={aiDetection.data}
        materials={materials}
        onMaterialsChange={onMaterialsChange}
        onBack={() => onEditingChange(false)}
      />
    ) : (
      <div className="py-12">
        <Banner
          status="info"
          title={job.posting_text.trim()
            ? 'Select a resume and click "Analyze" to begin tailoring.'
            : 'Add a job posting first to tailor your resume.'}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ResumePicker
            resumes={resumes}
            resumeText={resumeText}
            onPick={onPickResume}
            onAdded={onResumeAdded}
            onError={setUploadError}
          />
          <Button
            label="Edit"
            variant="secondary"
            size="sm"
            onClick={() => onEditingChange(true)}
            isDisabled={!analyzed}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <WithAiToggle checked={withAi} onChange={onWithAiChange} />
          <Button
            label={analyzing ? "Analyzing…" : analyzed ? "Re-run analysis" : "Analyze"}
            variant="primary"
            size="sm"
            onClick={onAnalyze}
            isDisabled={analyzing || !job.posting_text.trim() || !resumeText.trim()}
          />
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

"use client";

import { useConfirm } from "@/hooks/useConfirm";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { ContextMaterial } from "@/lib/context";
import type { ResumeRow } from "@/lib/db/resumes";
import { CandidateProfilePanel } from "./CandidateProfilePanel";
import { CoverLetterView } from "./CoverLetterView";
import { ResumeView } from "./ResumeView";
import { JobActivityBanner } from "./JobActivityBanner";
import { loadContextMaterials, saveContextMaterials, tailoredResumeText } from "@/lib/storage";
import { apiSend, errorMessage } from "@/lib/api-client";
import { useJob } from "@/hooks/useJob";
import { useAiDetection } from "@/hooks/useAiDetection";
import { useSavedResumes } from "./job-workspace/useSavedResumes";
import { useFitness } from "./job-workspace/useFitness";
import { useMatchAnalysis } from "./job-workspace/useMatchAnalysis";
import { useWithAi } from "./job-workspace/useWithAi";
import { useDraft } from "./job-workspace/useDraft";
import { useSplitPane } from "./job-workspace/useSplitPane";
import { saveApplicationDocs } from "./job-workspace/applicationDocs";
import { JobHeader, EMPTY_HEADER } from "./job-workspace/JobHeader";
import { PostingPane, type LeftTab } from "./job-workspace/PostingPane";
import { FitnessTab } from "./job-workspace/FitnessTab";
import { MatchTab } from "./job-workspace/MatchTab";
import { ResumePicker } from "./job-workspace/ResumePicker";
import { SubmissionPanel, type SubmissionEdit } from "./job-workspace/SubmissionPanel";
import { NotesPanel } from "./job-workspace/NotesPanel";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useMediaQuery } from "@astryxdesign/core/hooks";

type RightTab = "profile" | "resume" | "application" | "tools";
type MobilePane = "posting" | "analysis";
type AppSubTab = "notes" | "submission";
type ToolsSubTab = "profile" | "resume" | "cover";

export function JobWorkspace({ jobId }: { jobId: number }) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { job, setJob, submissions, loading, refetch: fetchJob, updateJob } = useJob(jobId);
  const { savedResumes, setSavedResumes, resumeText, setResumeText } = useSavedResumes(job);
  // Writes that fail outside a tab with its own error slot (status, header,
  // posting, notes, submissions) report here.
  const [actionError, setActionError] = useState<string | null>(null);
  const fitness = useFitness({ jobId, job, setJob, updateJob, refetchJob: fetchJob });
  const match = useMatchAnalysis({ jobId, job, setJob, resumeText, savedResumes });
  const { analyzed } = match;
  const aiDetection = useAiDetection(analyzed);
  const [withAi, setWithAi] = useWithAi();
  const [analyzing, setAnalyzing] = useState(false);

  const [leftTab, setLeftTab] = useState<LeftTab>("posting");
  const [rightTab, setRightTab] = useState<RightTab>("profile");
  const [appSubTab, setAppSubTab] = useState<AppSubTab>("notes");
  const [toolsSubTab, setToolsSubTab] = useState<ToolsSubTab>("profile");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobilePane, setMobilePane] = useState<MobilePane>("posting");
  const { splitPct, containerRef, onDragStart } = useSplitPane();
  // The nav right-aligns the job controls to the left column's edge, where the card begins.
  useEffect(() => {
    if (isMobile) return;
    const root = document.documentElement;
    root.style.setProperty("--job-split", `${splitPct}%`);
    return () => { root.style.removeProperty("--job-split"); };
  }, [isMobile, splitPct]);

  const headerDraft = useDraft(EMPTY_HEADER);
  const notesDraft = useDraft("");
  const pasteDraft = useDraft("");
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);

  const [materials, setMaterials] = useState<ContextMaterial[]>(() => loadContextMaterials());
  useEffect(() => { saveContextMaterials(materials); }, [materials]);

  // The saved resume the picked text came from (none for an edited, unsaved one).
  const pickedResume = savedResumes.find((r) => r.content === resumeText) ?? null;

  useEffect(() => {
    if (job) {
      window.dispatchEvent(new CustomEvent("job-workspace-sync", {
        detail: { jobId: job.id, status: job.status, analyzing: analyzing || fitness.running }
      }));
    }
  }, [job, analyzing, fitness.running]);

  const runAnalysis = () => {
    if (!match.run()) return;
    setRightTab("resume");
  };

  // The resume tab's Analyze "with AI" also re-runs the fitness check.
  const runUnifiedAnalysis = async () => {
    if (!job || !job.posting_text.trim()) return;
    setAnalyzing(true);
    fitness.setError(null);
    if (resumeText.trim()) runAnalysis();
    await fitness.run(true);
    setAnalyzing(false);
  };

  const openTool = (tool: ToolsSubTab) => {
    setToolsSubTab(tool);
    setRightTab("tools");
  };

  const updateStatus = useCallback(async (newStatus: string) => {
    const wasApplied = job?.status === "applied";
    setActionError(null);
    try {
      await updateJob({ status: newStatus });
    } catch (err) {
      setActionError(errorMessage(err, "Could not change the status."));
      return;
    }
    // Marking it Applied records what was sent: the resume and cover letter.
    if (newStatus === "applied" && !wasApplied) {
      try {
        await saveApplicationDocs(jobId, { name: pickedResume?.name ?? null, text: resumeText });
      } catch (err) {
        setActionError(errorMessage(err, "Status changed, but the resume and cover letter could not be saved."));
      }
    }
    fetchJob();
  }, [job, jobId, pickedResume, resumeText, fetchJob, updateJob]);

  const deleteJob = useCallback(async () => {
    if (!(await confirm({ title: "Delete this job?", description: "Its notes, saved documents and reports are deleted too. This can't be undone.", actionLabel: "Delete" }))) return;
    try {
      await apiSend(`/api/jobs/${jobId}`, "DELETE");
    } catch (err) {
      setActionError(errorMessage(err, "Could not delete the job."));
      return;
    }
    router.push("/jobs");
  }, [jobId, router, confirm]);

  // The nav's status selector acts on this job through an event.
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ action: string; status?: string }>;
      if (custom.detail?.action === "status" && custom.detail.status) updateStatus(custom.detail.status);
    };
    window.addEventListener("job-workspace-action", handler);
    return () => window.removeEventListener("job-workspace-action", handler);
  }, [updateStatus]);

  // Runs a write, reporting failure in the workspace's error banner. Edit
  // forms stay open on failure so nothing typed is lost.
  const attempt = async (write: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setActionError(null);
    try {
      await write();
      return true;
    } catch (err) {
      setActionError(errorMessage(err, fallback));
      return false;
    }
  };

  const saveHeader = async () => {
    if (await attempt(() => updateJob(headerDraft.value), "Could not save the job details.")) headerDraft.close();
  };

  const savePaste = async () => {
    if (!pasteDraft.value.trim()) return;
    if (await attempt(() => updateJob({ posting_text: pasteDraft.value.trim() }), "Could not save the posting.")) pasteDraft.close();
  };

  const saveNotes = async () => {
    if (await attempt(() => updateJob({ notes: notesDraft.value }), "Could not save notes.")) notesDraft.close();
  };

  const saveSubmission = async ({ type, existing, label, format, content }: SubmissionEdit): Promise<boolean> => {
    const ok = await attempt(
      () => existing
        ? apiSend(`/api/jobs/${jobId}/submissions/${existing.id}`, "PATCH", { label, format, content })
        : apiSend(`/api/jobs/${jobId}/submissions`, "POST", { type, label, format, content }),
      "Could not save the submission.",
    );
    if (ok) fetchJob();
    return ok;
  };

  const deleteSubmission = async (sid: number) => {
    if (await attempt(() => apiSend(`/api/jobs/${jobId}/submissions/${sid}`, "DELETE"), "Could not remove the submission.")) fetchJob();
  };

  // Tools › Resume saved over the picked resume, or as a new one: pick it.
  const onResumeSaved = (row: ResumeRow, isNew: boolean) => {
    setSavedResumes((prev) => (isNew ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r))));
    setResumeText(row.content);
  };

  if (loading) return <div className="py-12 text-center"><Spinner label="Loading…" /></div>;
  if (!job) return <div className="py-12"><Banner status="error" title="Job not found." /></div>;

  const jobHeaderInner = (
    <JobHeader
      job={job}
      draft={headerDraft}
      onSave={saveHeader}
      onRestoreStatus={updateStatus}
      onDelete={deleteJob}
      error={actionError}
      onDismissError={() => setActionError(null)}
    />
  );

  const leftTabBar = (
    <TabList value={leftTab} onChange={(v) => setLeftTab(v as LeftTab)}>
      <Tab value="posting" label="Job Posting" />
      <Tab value="apply" label="Apply" />
    </TabList>
  );

  const leftPaneBody = (
    <PostingPane tab={leftTab} job={job} report={analyzed?.report ?? null} paste={pasteDraft} onSavePaste={savePaste} />
  );

  const activityBanner = (
    <JobActivityBanner job={job} submissions={submissions} defaultCollapsed={isMobile} flush={!isMobile} />
  );

  const rightTabBar = (
    <TabList value={rightTab} onChange={(v) => setRightTab(v as RightTab)}>
      <Tab value="profile" label={fitness.saved ? `Profile (${fitness.saved.score}/10)` : "Profile"} />
      <Tab value="resume" label={analyzed ? `Resume (${analyzed.report.score}/100)` : "Resume"} />
      <Tab value="application" label={submissions.length > 0 ? `Application (${submissions.length})` : "Application"} />
      <Tab value="tools" label="Tools" />
    </TabList>
  );

  const editingNotes = appSubTab === "notes" && notesDraft.isOpen;

  const resumePicker = (
    <ResumePicker
      resumes={savedResumes}
      resumeText={resumeText}
      onPick={setResumeText}
      onAdded={(r) => { setSavedResumes(prev => [...prev, r]); setResumeText(r.content); }}
      onError={setResumeUploadError}
    />
  );

  const rightPaneBody = (
    <>
      {rightTab === "profile" && (
        <div className="space-y-4">
          <FitnessTab
            job={job}
            fitness={fitness}
            withAi={withAi}
            onWithAiChange={setWithAi}
            onEditProfile={() => openTool("profile")}
          />
        </div>
      )}

      {rightTab === "resume" && (
        <div className="space-y-4">
          <MatchTab
            job={job}
            match={match}
            aiDetection={aiDetection}
            resumes={savedResumes}
            resumeText={resumeText}
            onPickResume={setResumeText}
            onResumeAdded={(r) => { setSavedResumes(prev => [...prev, r]); setResumeText(r.content); }}
            withAi={withAi}
            onWithAiChange={setWithAi}
            analyzing={analyzing}
            onAnalyze={() => (withAi ? runUnifiedAnalysis() : runAnalysis())}
            onEdit={() => openTool("resume")}
          />
        </div>
      )}

      {rightTab === "application" && (
        // Editing notes, the text area takes the rest of the pane's height.
        <div className={editingNotes ? "flex h-full min-h-0 flex-col gap-4" : "space-y-4"}>
          <div className="flex items-center gap-2">
            <SegmentedControl value={appSubTab} onChange={(v) => setAppSubTab(v as AppSubTab)} label="Application view">
              <SegmentedControlItem value="notes" label="Notes" />
              <SegmentedControlItem
                value="submission"
                label={submissions.length > 0 ? `Submission (${submissions.length})` : "Submission"}
              />
            </SegmentedControl>
            {appSubTab === "notes" && !editingNotes && (
              <Button label="Edit" variant="secondary" size="sm" onClick={() => notesDraft.open(job.notes)} />
            )}
            {editingNotes && (
              <div className="ml-auto flex shrink-0 gap-2">
                <Button label="Cancel" variant="secondary" size="sm" onClick={notesDraft.close} />
                <Button label="Save" variant="primary" size="sm" onClick={saveNotes} />
              </div>
            )}
          </div>

          {appSubTab === "notes" && <NotesPanel notes={job.notes} draft={notesDraft} />}

          {appSubTab === "submission" && (
            <SubmissionPanel
              jobId={jobId}
              submissions={submissions}
              resumes={savedResumes}
              onSave={saveSubmission}
              onRemove={deleteSubmission}
            />
          )}
        </div>
      )}

      {rightTab === "tools" && (
        <div className="space-y-4">
          <SegmentedControl value={toolsSubTab} onChange={(v) => setToolsSubTab(v as ToolsSubTab)} label="Tool">
            <SegmentedControlItem value="profile" label="Profile" />
            <SegmentedControlItem value="resume" label="Resume" />
            <SegmentedControlItem value="cover" label="Cover letter" />
          </SegmentedControl>

          {toolsSubTab === "profile" && <CandidateProfilePanel embedded />}

          {toolsSubTab === "resume" && (
            <>
              {resumeUploadError && <Banner status="error" title={resumeUploadError} />}
              {resumeText.trim() ? (
                <ResumeView
                  // A different resume starts a fresh working copy.
                  key={resumeText}
                  jobId={jobId}
                  resumeText={resumeText}
                  resume={pickedResume}
                  company={job.company}
                  jobText={job.posting_text}
                  jobTitle={job.title}
                  missingSkills={analyzed?.report.highlights.missing ?? []}
                  aiDetection={aiDetection.data}
                  materials={materials}
                  onMaterialsChange={setMaterials}
                  onSaved={onResumeSaved}
                  picker={resumePicker}
                />
              ) : (
                <>
                  {resumePicker}
                  <Banner status="info" title="Add a resume to tailor it for this job." />
                </>
              )}
            </>
          )}

          {toolsSubTab === "cover" && (
            <CoverLetterView
              jobId={jobId}
              resumeText={tailoredResumeText(jobId) || resumeText}
              jobText={job.posting_text}
              jobTitle={job.title}
              company={job.company}
              materials={materials}
              onMaterialsChange={setMaterials}
            />
          )}
        </div>
      )}
    </>
  );

  const rightPaneCardClass =
    "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_0_20px_rgba(0,0,0,0.18)] dark:shadow-[0_0_20px_rgba(0,0,0,0.9)]";

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-57px)] flex-col overflow-hidden bg-surface text-primary">
        <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
          <div className="flex items-start justify-between gap-3">{jobHeaderInner}</div>
          <div className="mt-3">{activityBanner}</div>
        </div>
        <div className="shrink-0 border-b border-border bg-surface px-4 py-2">
          <SegmentedControl value={mobilePane} onChange={(v) => setMobilePane(v as MobilePane)} label="View">
            <SegmentedControlItem value="posting" label="Posting" />
            <SegmentedControlItem value="analysis" label="Analysis" />
          </SegmentedControl>
        </div>
        {mobilePane === "posting" ? (
          <>
            <div className="shrink-0 border-b border-border bg-surface px-4">{leftTabBar}</div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4">{leftPaneBody}</div>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <div className={rightPaneCardClass}>
                <div className="shrink-0 border-b border-border px-4">{rightTabBar}</div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{rightPaneBody}</div>
              </div>
            </div>
          </>
        )}
        {confirmDialog}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative grid h-[calc(100vh-57px)] grid-rows-[auto_auto_minmax(0,1fr)] bg-surface text-primary"
      style={{ gridTemplateColumns: `${splitPct}% ${100 - splitPct}%` }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="absolute -top-[57px] bottom-0 z-50 w-1 cursor-col-resize bg-transparent hover:bg-brand/30 active:bg-brand/50 transition-colors"
        style={{ left: `${splitPct}%`, transform: "translateX(-50%)" }}
      />
      {/* Header */}
      <div className="col-start-1 row-start-1 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-start justify-between gap-3">{jobHeaderInner}</div>
      </div>

      {/* Left tabs */}
      <div className="col-start-1 row-start-2 border-b border-border bg-surface px-4">{leftTabBar}</div>

      {/* Carry the header and tab rules across the right column; the card paints over them */}
      <div aria-hidden className="col-start-2 row-start-1 border-b border-border" />
      <div aria-hidden className="col-start-2 row-start-2 border-b border-border" />

      {/* Left content */}
      <div className="col-start-1 row-start-3 min-h-0 overflow-y-auto bg-surface p-4">{leftPaneBody}</div>

      {/* Right pane: activity banner, tabs, content. It rises over the nav
          (whose controls sit on the left on job pages) to the top of the window. */}
      <div className="relative z-40 col-start-2 row-start-1 row-span-3 -mt-[57px] flex min-h-0 flex-col p-3 sm:p-4">
        <div className={rightPaneCardClass}>
          <div className="shrink-0">{activityBanner}</div>
          <div className="shrink-0 border-b border-border px-4 py-3 flex items-center min-h-[57px]">{rightTabBar}</div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 text-sm">{rightPaneBody}</div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

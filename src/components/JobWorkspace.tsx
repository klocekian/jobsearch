"use client";

import { useConfirm } from "@/hooks/useConfirm";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
import { useJobStepper } from "./job-workspace/useJobStepper";
import { saveApplicationDocs } from "./job-workspace/applicationDocs";
import { JobHeader, EMPTY_HEADER } from "./job-workspace/JobHeader";
import { PostingPane, type LeftTab } from "./job-workspace/PostingPane";
import { FitnessTab } from "./job-workspace/FitnessTab";
import { MatchTab } from "./job-workspace/MatchTab";
import { ResumePicker } from "./job-workspace/ResumePicker";
import { SubmissionPanel, type SubmissionEdit } from "./job-workspace/SubmissionPanel";
import { NotesPanel } from "./job-workspace/NotesPanel";
import { TabList, Tab } from "@/components/ui/TabList";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";
import { useMediaQuery } from "@/components/ui/hooks";
import styles from "./job-workspace/job.module.css";

type RightTab = "profile" | "resume" | "application" | "tools";
type MobilePane = "posting" | "analysis";
type AppSubTab = "notes" | "submission";
type ToolsSubTab = "profile" | "resume" | "cover";

export function JobWorkspace({ jobId }: { jobId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
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
  const [rightTab, setRightTab] = useState<RightTab>(requestedView === "prepare" ? "tools" : requestedView === "application" ? "application" : "profile");
  const [appSubTab, setAppSubTab] = useState<AppSubTab>("notes");
  const [toolsSubTab, setToolsSubTab] = useState<ToolsSubTab>("resume");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobilePane, setMobilePane] = useState<MobilePane>(requestedView ? "analysis" : "posting");
  const { splitPct, containerRef, onDragStart } = useSplitPane();
  const stepper = useJobStepper(jobId);

  const headerDraft = useDraft(EMPTY_HEADER);
  const notesDraft = useDraft("");
  const pasteDraft = useDraft("");
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);

  const [materials, setMaterials] = useState<ContextMaterial[]>(() => loadContextMaterials());
  useEffect(() => { saveContextMaterials(materials); }, [materials]);

  // The saved resume the picked text came from (none for an edited, unsaved one).
  const pickedResume = savedResumes.find((r) => r.content === resumeText) ?? null;

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

  // Prepare › Resume saved over the picked resume, or as a new one: pick it.
  const onResumeSaved = (row: ResumeRow, isNew: boolean) => {
    setSavedResumes((prev) => (isNew ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r))));
    setResumeText(row.content);
  };

  if (loading) return <div data-job-workspace className="grid place-items-center py-16"><Spinner label="Loading…" /></div>;
  if (!job) return <div data-job-workspace className="p-6"><Banner status="error" title="Job not found." /></div>;

  const jobHeaderInner = (
    <JobHeader
      job={job}
      draft={headerDraft}
      stepper={stepper}
      onSave={saveHeader}
      onStatusChange={updateStatus}
      onDelete={deleteJob}
      error={actionError}
      onDismissError={() => setActionError(null)}
    />
  );

  const leftTabBar = (
    <TabList value={leftTab} onChange={(v) => setLeftTab(v as LeftTab)} label="Posting views">
      <Tab value="posting" label="Posting" />
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
    <TabList value={rightTab} onChange={(v) => setRightTab(v as RightTab)} label="Analysis views">
      <Tab value="profile" label={fitness.saved ? `Fit · ${fitness.saved.score}/10` : "Fit"} />
      <Tab value="resume" label={analyzed ? `Resume check · ${analyzed.report.score}` : "Resume check"} />
      <Tab value="tools" label="Prepare" />
      <Tab value="application" label={submissions.length > 0 ? `Application (${submissions.length})` : "Application"} />
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
          <div className={styles.subNav}>
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
              <div className={styles.subNavEnd}>
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
          <SegmentedControl value={toolsSubTab} onChange={(v) => setToolsSubTab(v as ToolsSubTab)} label="Prepare">
            <SegmentedControlItem value="resume" label="Resume" />
            <SegmentedControlItem value="cover" label="Cover letter" />
            <SegmentedControlItem value="profile" label="Your profile" />
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

  if (isMobile) {
    return (
      <div data-job-workspace className={styles.workspace}>
        {jobHeaderInner}
        <div className={styles.mobileSwitch}>
          <SegmentedControl value={mobilePane} onChange={(v) => setMobilePane(v as MobilePane)} label="View">
            <SegmentedControlItem value="posting" label="Posting" />
            <SegmentedControlItem value="analysis" label="Analysis" />
          </SegmentedControl>
        </div>
        <div className={styles.body}>
          {mobilePane === "posting" ? (
            <section className={styles.pane}>
              <div className={styles.paneTabs}>{leftTabBar}</div>
              <div className={`${styles.paneContent} ${leftTab === "apply" ? styles.fill : ""}`}>{leftPaneBody}</div>
            </section>
          ) : (
            <section className={`${styles.pane} ${styles.analysis}`}>
              <div className={styles.activity}>{activityBanner}</div>
              <div className={styles.paneTabs}>{rightTabBar}</div>
              <div className={`${styles.paneContent} ${editingNotes ? styles.fill : ""}`}>{rightPaneBody}</div>
            </section>
          )}
        </div>
        {confirmDialog}
      </div>
    );
  }

  return (
    <div data-job-workspace className={styles.workspace}>
      {jobHeaderInner}
      <div ref={containerRef} className={styles.body} style={{ gridTemplateColumns: `${splitPct}% ${100 - splitPct}%` }}>
        <section className={styles.pane} aria-label="Posting">
          <div className={styles.paneTabs}>{leftTabBar}</div>
          <div className={`${styles.paneContent} ${leftTab === "apply" ? styles.fill : ""}`}>{leftPaneBody}</div>
        </section>
        <div role="separator" aria-orientation="vertical" aria-label="Resize panes" onMouseDown={onDragStart} className={styles.divider} style={{ left: `${splitPct}%` }} />
        <section className={`${styles.pane} ${styles.analysis}`} aria-label="Analysis">
          <div className={styles.activity}>{activityBanner}</div>
          <div className={styles.paneTabs}>{rightTabBar}</div>
          <div className={`${styles.paneContent} ${editingNotes ? styles.fill : ""}`}>{rightPaneBody}</div>
        </section>
      </div>
      {confirmDialog}
    </div>
  );
}

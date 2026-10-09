"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Markdown from "react-markdown";
import { analyze } from "@/lib/analysis/analyze";
import type { MatchReport } from "@/lib/analysis/types";
import type { ContextMaterial } from "@/lib/context";
import { MatchReportView, type AiDetectionState } from "./MatchReportView";
import { FitnessReportView } from "./FitnessReportView";
import { CandidateProfilePanel } from "./CandidateProfilePanel";
import type { FitnessResult } from "@/lib/fitness/schema";
import { renderFitnessText } from "@/lib/fitness/render";
import { JobDescriptionView } from "./JobDescriptionView";
import { ResumeView } from "./ResumeView";
import { CoverLetterView } from "./CoverLetterView";
import { JobActivityBanner } from "./JobActivityBanner";
import { RunHistory, runDate, runMethodLabel } from "./RunHistory";
import type { AnalysisRunMeta, AnalysisRunRow } from "@/lib/db/analysis-runs";
import {
  loadSavedResume,
  coverLetterText,
  clearCoverLetter,
  clearRewrite,
  loadContextMaterials,
  saveContextMaterials,
  loadAiDetection,
  saveAiDetection,
} from "@/lib/storage";
import { buildPackageMarkdown } from "@/lib/package";
import { readResumeFile } from "@/lib/extract";
import type { JobRow } from "@/lib/db/jobs";
import type { SubmissionRow } from "@/lib/db/submissions";
import type { ResumeRow } from "@/lib/db/resumes";
import { Button } from "@astryxdesign/core/Button";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Link as AstryxLink } from "@astryxdesign/core/Link";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Stack, HStack } from "@astryxdesign/core/Stack";
import { useMediaQuery } from "@astryxdesign/core/hooks";

type LeftTab = "posting" | "apply";
type RightTab = "profile" | "resume" | "application";
type MobilePane = "posting" | "analysis";
type ProfileSubTab = "score" | "edit";
type ResumeSubTab = "score" | "edit";
type AppSubTab = "cover" | "submission" | "notes";

export function JobWorkspace({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>("posting");
  const [rightTab, setRightTab] = useState<RightTab>("profile");
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>("score");
  const [resumeSubTab, setResumeSubTab] = useState<ResumeSubTab>("score");
  const [appSubTab, setAppSubTab] = useState<AppSubTab>("cover");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobilePane, setMobilePane] = useState<MobilePane>("posting");

  // Editing
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editingHeader, setEditingHeader] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<number | null>(null);
  const [headerFields, setHeaderFields] = useState({ title: "", company: "", location: "", salary_text: "", url: "" });

  // Paste posting
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Resume / Analysis state
  const [savedResumes, setSavedResumes] = useState<ResumeRow[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [userAnalysis, setUserAnalysis] = useState<{ report: MatchReport; resumeText: string; jobText: string } | null>(null);

  // Derived match report (from user trigger or stored in job row)
  const analyzed = useMemo(() => {
    if (userAnalysis) return userAnalysis;
    if (!job || !resumeText || !job.match_report || !job.posting_text) return null;
    try {
      const report = JSON.parse(job.match_report) as MatchReport;
      return { report, resumeText, jobText: job.posting_text };
    } catch {
      return null;
    }
  }, [userAnalysis, job, resumeText]);

  // AI detection: cached result if present, otherwise call /api/ai-detection with fallback
  // AI detection: cached result if present, otherwise call /api/ai-detection with fallback
  const [asyncAiDetection, setAsyncAiDetection] = useState<{ text: string; data: import("@/lib/analysis/types").AiDetection } | null>(null);

  const aiDetection = useMemo<AiDetectionState>(() => {
    if (!analyzed) return { status: "loading", data: null };
    const text = analyzed.resumeText;
    if (asyncAiDetection && asyncAiDetection.text === text) {
      return { status: "done", data: asyncAiDetection.data };
    }
    const cached = typeof window !== "undefined" ? loadAiDetection(text) : null;
    if (cached) return { status: "done", data: cached };
    return { status: "done", data: analyzed.report.aiDetection };
  }, [analyzed, asyncAiDetection]);

  useEffect(() => {
    if (!analyzed) return;
    const text = analyzed.resumeText;
    const cached = typeof window !== "undefined" ? loadAiDetection(text) : null;
    if (cached) return;

    let active = true;
    fetch("/api/ai-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: text }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { confidence?: number; band?: string; patterns?: unknown } | null) => {
        if (!active) return;
        if (d && typeof d.confidence === "number" && Array.isArray(d.patterns)) {
          const det = d as unknown as import("@/lib/analysis/types").AiDetection;
          saveAiDetection(text, det);
          setAsyncAiDetection({ text, data: det });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [analyzed]);

  // Fitness check. `saved` is the report already written to the job; `pending`
  // is a fresh run that has NOT been written yet — the panel renders and waits
  // for an explicit Save, so a run never mutates the job on its own.
  const [fitnessRunning, setFitnessRunning] = useState(false);
  const [fitnessSaving, setFitnessSaving] = useState(false);
  const [fitnessError, setFitnessError] = useState<string | null>(null);
  const [notesFlash, setNotesFlash] = useState(false);
  // Derived, not stored: the job row is the source of truth for a saved
  // report, so a re-fetch after saving updates this with no extra state.
  const fitnessReportJson = job?.fitness_report ?? null;
  const fitnessSaved = useMemo<FitnessResult | null>(() => {
    if (!fitnessReportJson) return null;
    try { return JSON.parse(fitnessReportJson) as FitnessResult; } catch { return null; }
  }, [fitnessReportJson]);
  // Saved run history (both analyses) and the older run being viewed, if any.
  const [runs, setRuns] = useState<{ fitness: AnalysisRunMeta[]; match: AnalysisRunMeta[] }>({ fitness: [], match: [] });
  const [viewedFitness, setViewedFitness] = useState<{ id: number; result: FitnessResult; runAt: string; method: string } | null>(null);
  const [viewedMatch, setViewedMatch] = useState<{ id: number; report: MatchReport; resumeText: string | null } | null>(null);
  const [restoringRun, setRestoringRun] = useState(false);
  // What each tab shows: the viewed older run if one is picked, else the current one.
  const shownFitness = viewedFitness?.result ?? fitnessSaved;
  const shownFitnessRunAt = viewedFitness?.runAt ?? job?.fitness_run_at ?? null;
  const shownFitnessMethod = viewedFitness
    ? viewedFitness.method
    : runs.fitness.find((r) => r.id === job?.fitness_run_id)?.method ?? "";
  const shownMatch = viewedMatch && job
    ? { report: viewedMatch.report, resumeText: viewedMatch.resumeText ?? resumeText, jobText: job.posting_text }
    : analyzed;
  const [materials, setMaterials] = useState<ContextMaterial[]>(() => loadContextMaterials());
  const fileRef = useRef<HTMLInputElement>(null);
  const resumeFileRef = useRef<HTMLInputElement>(null);
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveContextMaterials(materials); }, [materials]);

  const fetchRuns = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/analysis-runs`).catch(() => null);
    if (res?.ok) setRuns(await res.json());
  }, [jobId]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/jobs/${jobId}/analysis-runs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!ignore && d) setRuns(d); })
      .catch(() => {});
    return () => { ignore = true; };
  }, [jobId]);

  const viewRun = useCallback(async (kind: "fitness" | "match", runId: number | null) => {
    if (runId == null) {
      if (kind === "fitness") setViewedFitness(null); else setViewedMatch(null);
      return;
    }
    const res = await fetch(`/api/jobs/${jobId}/analysis-runs/${runId}`).catch(() => null);
    if (!res?.ok) return;
    const { run } = await res.json() as { run: AnalysisRunRow };
    try {
      if (kind === "fitness") {
        setViewedFitness({ id: run.id, result: JSON.parse(run.report) as FitnessResult, runAt: run.created_at, method: run.method });
      } else {
        setViewedMatch({ id: run.id, report: JSON.parse(run.report) as MatchReport, resumeText: run.resume_text });
      }
    } catch { /* unreadable report — stay on the current one */ }
  }, [jobId]);

  const makeRunCurrent = useCallback(async (kind: "fitness" | "match", runId: number) => {
    setRestoringRun(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/analysis-runs/${runId}`, { method: "POST" });
      if (res.ok) {
        const d = await res.json() as { job: JobRow };
        setJob(d.job);
        if (kind === "fitness") setViewedFitness(null);
        else {
          // The restored report is about the resume it ran against — show that one.
          if (viewedMatch?.id === runId && viewedMatch.resumeText) setResumeText(viewedMatch.resumeText);
          setViewedMatch(null);
          setUserAnalysis(null);
        }
      }
    } finally {
      setRestoringRun(false);
    }
  }, [jobId, viewedMatch]);

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) { setLoading(false); return; }
    const data: { job: JobRow; submissions: SubmissionRow[] } = await res.json();
    setJob(data.job);
    setSubmissions(data.submissions);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/jobs/${jobId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { job: JobRow; submissions: SubmissionRow[] } | null) => {
        if (ignore) return;
        if (data) {
          setJob(data.job);
          setSubmissions(data.submissions);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [jobId]);

  // Load saved resumes and auto-select default
  useEffect(() => {
    fetch("/api/resumes").then(r => r.json()).then((d: { resumes?: ResumeRow[] }) => {
      const list = d.resumes ?? [];
      setSavedResumes(list);
      if (!resumeText && list.length > 0) {
        const def = list.find(r => r.is_default) ?? list[0];
        setResumeText(def.content);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open on the resume the stored match score was run against, not just the
  // default, so the saved report and the resume text shown beside it agree.
  const resumePicked = useRef(false);
  useEffect(() => {
    if (resumePicked.current || !job || savedResumes.length === 0) return;
    resumePicked.current = true;
    const match = job.match_resume_name ? savedResumes.find((r) => r.name === job.match_resume_name) : undefined;
    if (match) setResumeText(match.content); // eslint-disable-line react-hooks/set-state-in-effect
  }, [job, savedResumes]);

    const [analyzing, setAnalyzing] = useState(false);
  const [withAi, setWithAi] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jobWorkspaceWithAi") === "1";
    }
    return false;
  });

  useEffect(() => {
    if (job) {
      window.dispatchEvent(new CustomEvent("job-workspace-sync", {
        detail: { jobId: job.id, status: job.status, analyzing: analyzing || fitnessRunning }
      }));
    }
  }, [job, analyzing, fitnessRunning]);

  const runAnalysis = useCallback(() => {
    if (!job || !resumeText.trim() || !job.posting_text.trim()) return;
    if (!analyzed || analyzed.jobText !== job.posting_text) {
      clearCoverLetter();
      clearRewrite();
    }
    const report = analyze({
      resumeText, jobText: job.posting_text,
      company: job.company, jobTitle: job.title, jobUrl: job.url, fileName: "",
    });
    setUserAnalysis({ report, resumeText, jobText: job.posting_text });
    setRightTab("resume");
    setResumeSubTab("score");
    setViewedMatch(null);
    const selectedResume = savedResumes.find(r => r.content === resumeText);
    fetch(`/api/jobs/${jobId}/analysis-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "match",
        report,
        // Record which resume produced the score, so the ATS number reads as a
        // fact about a document rather than a verdict on the job.
        resume_name: selectedResume?.name ?? null,
        resume_text: resumeText,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { job?: JobRow } | null) => {
        if (d?.job) setJob(d.job);
        fetchRuns();
      })
      .catch(() => {});
    if (selectedResume && job.company) {
      fetch(`/api/resumes/${selectedResume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_tag: job.company }),
      }).catch(() => {});
    }
  }, [job, resumeText, analyzed, savedResumes, jobId, fetchRuns]);

  const runFitnessCheck = useCallback(async (useAi = false) => {
    if (!job || !job.posting_text.trim()) return;
    setFitnessRunning(true);
    setFitnessError(null);
    setNotesFlash(false);
    try {
      const res = await fetch("/api/fitness-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, use_ai: useAi }),
      });
      // The route saves the run itself and returns the updated job.
      const data = await res.json() as { result?: FitnessResult; job?: JobRow; error?: string };
      if (!res.ok || !data.result) {
        setFitnessError(data.error ?? "Fitness check failed.");
        return;
      }
      setViewedFitness(null);
      if (data.job) setJob(data.job);
      else await fetchJob();
      await fetchRuns();
    } catch {
      setFitnessError("Fitness check failed.");
    } finally {
      setFitnessRunning(false);
    }
  }, [job, jobId, fetchJob, fetchRuns]);

  const runUnifiedAnalysis = useCallback(async (useAi = false) => {
    if (!job || !job.posting_text.trim()) return;
    setAnalyzing(true);
    setFitnessError(null);

    // 1. Run ATS Match Analysis (if resume is available)
    if (resumeText.trim()) {
      runAnalysis();
    }

    // 2. Run Fitness Check (deterministic or AI)
    await runFitnessCheck(useAi);
    setAnalyzing(false);
  }, [job, resumeText, runAnalysis, runFitnessCheck]);

  /**
   * Writing the report into the job's notes, and abandoning the job, stay
   * behind explicit presses. Persisting the report is bookkeeping; these two
   * are decisions, and automating a decision is how you stop reading the
   * report that informs it.
   */
  const addFitnessToNotes = async (alsoAbandon: boolean) => {
    if (!job || !shownFitness) return;
    setFitnessSaving(true);
    const stamp = shownFitnessRunAt ? runDate(shownFitnessRunAt).toLocaleString() : new Date().toLocaleString();
    const header = `--- Fitness check · ${stamp}` +
      `${shownFitnessMethod ? ` · ${shownFitnessMethod}` : ""} ---`;
    const body = [header, renderFitnessText(shownFitness)].filter(Boolean).join("\n");
    const notes = job.notes?.trim() ? `${body}\n\n${job.notes}` : body;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, ...(alsoAbandon ? { status: "abandoned" } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setFitnessError(d.error ?? `Could not write to notes (${res.status}).`);
        return;
      }
      setFitnessError(null);
      setNotesFlash(true);
      await fetchJob();
    } catch {
      setFitnessError("Could not write to notes — no response from the server.");
    } finally {
      setFitnessSaving(false);
    }
  };

  const updateStatus = useCallback(async (newStatus: string) => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (newStatus === "applied" && analyzed && job) {
      const resume = loadSavedResume();
      const md = buildPackageMarkdown({
        company: job.company, jobTitle: job.title, jobUrl: job.url,
        jobText: job.posting_text, resume, resumeFallbackText: analyzed.resumeText,
        coverLetter: coverLetterText(),
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
      await fetch(`/api/jobs/${jobId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "package", label: `Application Package — ${new Date().toLocaleDateString()}`, format: "md", content: md }),
      });
    }
    fetchJob();
  }, [jobId, analyzed, job, fetchJob]);

  const deleteJob = useCallback(async () => {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    router.push("/jobs");
  }, [jobId, router]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ action: string; status?: string; withAi?: boolean }>;
      if (!custom.detail) return;
      if (custom.detail.action === "analyze") {
        runUnifiedAnalysis(!!custom.detail.withAi);
      } else if (custom.detail.action === "status" && custom.detail.status) {
        updateStatus(custom.detail.status);
      } else if (custom.detail.action === "delete") {
        deleteJob();
      }
    };
    window.addEventListener("job-workspace-action", handler);
    return () => window.removeEventListener("job-workspace-action", handler);
  }, [runUnifiedAnalysis, updateStatus, deleteJob]);

  const saveNotes = async () => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editNotes }),
    });
    setEditing(false);
    fetchJob();
  };

  const pasteDirect = async () => {
    if (!pasteText.trim()) return;
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posting_text: pasteText.trim() }),
    });
    setPasting(false);
    setPasteText("");
    fetchJob();
  };

  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", "other");
    form.append("label", file.name);
    await fetch(`/api/jobs/${jobId}/submissions`, { method: "POST", body: form });
    fetchJob();
  };

  const deleteSubmission = async (sid: number) => {
    await fetch(`/api/jobs/${jobId}/submissions/${sid}`, { method: "DELETE" });
    fetchJob();
  };

  const saveHeader = async () => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(headerFields),
    });
    setEditingHeader(false);
    fetchJob();
  };

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.max(25, Math.min(75, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  if (loading) return <div className="py-12 text-center"><Spinner label="Loading…" /></div>;
  if (!job) return <div className="py-12"><Banner status="error" title="Job not found." /></div>;

  const jobHeaderInner = (
    <div className="min-w-0 flex-1">
      {editingHeader ? (
        <div className="mt-1 space-y-1.5">
          <TextInput label="Job title" isLabelHidden value={headerFields.title} onChange={(v) => setHeaderFields(f => ({ ...f, title: v }))} placeholder="Job title" />
          <div className="flex gap-1.5">
            <TextInput label="Company" isLabelHidden value={headerFields.company} onChange={(v) => setHeaderFields(f => ({ ...f, company: v }))} placeholder="Company" />
            <TextInput label="Location" isLabelHidden value={headerFields.location} onChange={(v) => setHeaderFields(f => ({ ...f, location: v }))} placeholder="Location" />
          </div>
          <div className="flex gap-1.5">
            <TextInput label="Salary" isLabelHidden value={headerFields.salary_text} onChange={(v) => setHeaderFields(f => ({ ...f, salary_text: v }))} placeholder="Salary" />
            <TextInput label="URL" isLabelHidden value={headerFields.url} onChange={(v) => setHeaderFields(f => ({ ...f, url: v }))} placeholder="URL" />
          </div>
          <div className="flex gap-1.5">
            <Button label="Save" variant="primary" size="sm" onClick={saveHeader} />
            <Button label="Cancel" variant="secondary" size="sm" onClick={() => setEditingHeader(false)} />
          </div>
        </div>
      ) : (
        <div className="group">
          <HStack gap={2} className="items-center">
            <Heading level={2}>{job.title || "Untitled"}</Heading>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                label="Edit"
                variant="ghost"
                size="sm"
                onClick={() => { setHeaderFields({ title: job.title, company: job.company, location: job.location, salary_text: job.salary_text, url: job.url }); setEditingHeader(true); }}
              />
            </span>
          </HStack>
          <Text type="supporting" display="block">
            {job.company}
            {job.location && <> · {job.location}</>}
            {job.salary_text && <> · {job.salary_text}</>}
          </Text>
          {job.status === "closed" && job.previous_status && (
            <div className="mt-2 flex items-center justify-between p-2 px-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 text-xs">
              <span>This job was auto-marked closed (previously <strong>{job.previous_status}</strong>).</span>
              <button
                type="button"
                onClick={() => updateStatus(job.previous_status!)}
                className="font-medium underline hover:no-underline ml-2 cursor-pointer"
              >
                Restore to {job.previous_status}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const leftTabBar = (
    <TabList value={leftTab} onChange={(v) => setLeftTab(v as LeftTab)}>
      <Tab value="posting" label="Job Posting" />
      <Tab value="apply" label="Apply" />
    </TabList>
  );

  const leftPaneBody = (
    <>
      {leftTab === "posting" && (
        <div className="space-y-3">
          {!pasting && (
            <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
              {analyzed && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-1 w-4 rounded bg-rose-600 dark:bg-rose-400" />
                    <Text type="supporting">Missing Skills</Text>
                  </div>
                  <div className="flex items-center gap-1.5 mr-1">
                    <span className="inline-block h-1 w-4 rounded bg-emerald-600 dark:bg-emerald-400" />
                    <Text type="supporting">Matched Skills</Text>
                  </div>
                </>
              )}
              <Button label={job.posting_text ? "Update posting" : "Paste posting"} variant="secondary" size="sm" onClick={() => setPasting(true)} />
              {job.url && (
                <AstryxLink href={job.url} isExternalLink>Open original</AstryxLink>
              )}
            </div>
          )}
          {pasting && (
            <div className="rounded-lg border border-border bg-muted p-3">
              <TextArea label="Paste posting" isLabelHidden value={pasteText} onChange={setPasteText} placeholder="Paste job posting text…" rows={6} />
              <div className="mt-2 flex gap-2">
                <Button label="Save" variant="primary" size="sm" onClick={pasteDirect} isDisabled={!pasteText.trim()} />
                <Button label="Cancel" variant="secondary" size="sm" onClick={() => { setPasting(false); setPasteText(""); }} />
              </div>
            </div>
          )}
          {job.posting_text ? (
            analyzed ? (
              <JobDescriptionView
                jobText={job.posting_text}
                jobTitle={job.title}
                matched={analyzed.report.highlights.matched}
                missing={analyzed.report.highlights.missing}
                hideLegend
              />
            ) : (
              <Card className="p-4 sm:p-5">
                <Text display="block" className="whitespace-pre-wrap text-xs leading-relaxed">{job.posting_text}</Text>
              </Card>
            )
          ) : (
            <Banner status="info" title="No posting text. Paste it above or use the Chrome extension." />
          )}
        </div>
      )}

      {leftTab === "apply" && (
        job.url ? (
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center gap-2">
              <AstryxLink href={job.url} isExternalLink>Open in new tab</AstryxLink>
              <Text type="supporting">Many sites block embedding — use the link above if the form doesn&apos;t load below.</Text>
            </div>
            <iframe src={job.url} className="flex-1 w-full rounded-lg border border-border" title="Application" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
          </div>
        ) : (
          <Banner status="info" title="No URL saved for this job. Add one to open the application here." />
        )
      )}
    </>
  );

  const resumePicker = (
    <div className="flex items-center gap-2 min-w-0">
      {savedResumes.length > 0 ? (
        <Selector
          label="Resume"
          isLabelHidden
          className="max-w-[220px]"
          options={[
            ...savedResumes.map(r => ({ value: String(r.id), label: `${r.name}${r.is_default ? " (default)" : ""}` })),
            { value: "__add_new__", label: "+ Add resume…" },
          ]}
          value={String(savedResumes.find(r => r.content === resumeText)?.id ?? "")}
          onChange={(v) => {
            if (v === "__add_new__") {
              resumeFileRef.current?.click();
              return;
            }
            const r = savedResumes.find(r => r.id === Number(v));
            if (r) setResumeText(r.content);
          }}
        />
      ) : (
        <Button label="+ Add resume" variant="secondary" size="sm" onClick={() => resumeFileRef.current?.click()} />
      )}
      <input
        ref={resumeFileRef}
        type="file"
        className="hidden"
        accept=".txt,.md,.pdf,.docx"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = "";
          setResumeUploadError(null);
          let text = "";
          let name = "";
          try {
            const read = await readResumeFile(file);
            text = read.text;
            name = read.name.replace(/[^a-zA-Z0-9]/g, "_");
          } catch (err) {
            setResumeUploadError(err instanceof Error ? err.message : `Couldn't read ${file.name}.`);
            return;
          }
          const res = await fetch("/api/resumes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, content: text }),
          });
          if (res.ok) {
            const d = await res.json();
            setSavedResumes(prev => [...prev, d.resume]);
            setResumeText(text);
          }
        }}
      />
    </div>
  );

  const activityBanner = (
    <JobActivityBanner job={job} submissions={submissions} onJobUpdated={setJob} defaultCollapsed={isMobile} />
  );

  const rightTabBar = (
    <TabList value={rightTab} onChange={(v) => setRightTab(v as RightTab)}>
      <Tab value="profile" label={fitnessSaved ? `Profile (${fitnessSaved.score}/10)` : "Profile"} />
      <Tab value="resume" label={analyzed ? `Resume (${analyzed.report.score}/100)` : "Resume"} />
      <Tab value="application" label={submissions.length > 0 ? `Application (${submissions.length})` : "Application"} />
    </TabList>
  );

  const rightPaneBody = (
    <>
      {rightTab === "profile" && (
        <div className="space-y-4">
          {profileSubTab === "score" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  label="Edit"
                  variant="secondary"
                  size="sm"
                  onClick={() => setProfileSubTab("edit")}
                />

                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={withAi}
                      onChange={(e) => {
                        setWithAi(e.target.checked);
                        if (typeof window !== "undefined") {
                          localStorage.setItem("jobWorkspaceWithAi", e.target.checked ? "1" : "0");
                        }
                      }}
                      className="accent-primary rounded cursor-pointer"
                    />
                    <span>with AI</span>
                  </label>
                  <Button
                    label={fitnessRunning ? "Analyzing…" : fitnessSaved ? "Re-run analysis" : "Analyze"}
                    variant="primary"
                    size="sm"
                    onClick={() => runFitnessCheck(withAi)}
                    isDisabled={fitnessRunning || !job.posting_text.trim()}
                  />
                </div>
              </div>

              <div className="py-2">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {!fitnessRunning && (runs.fitness.length > 0 ? (
                    <RunHistory
                      runs={runs.fitness}
                      currentRunId={job.fitness_run_id}
                      viewingRunId={viewedFitness?.id ?? null}
                      outOf={10}
                      onView={(id) => viewRun("fitness", id)}
                      onMakeCurrent={(id) => makeRunCurrent("fitness", id)}
                      busy={restoringRun}
                    />
                  ) : job.fitness_run_at && (
                    <Text type="supporting" color="secondary">
                      Last run {new Date(job.fitness_run_at).toLocaleString()}
                    </Text>
                  ))}
                  {notesFlash && <Badge variant="success" label="Added to notes" />}
                </div>

                {fitnessError && (
                  <div className="mb-4">
                    <Banner status="error" title={fitnessError} />
                  </div>
                )}
                {fitnessRunning && (
                  <div className="flex items-center gap-2 py-8">
                    <Spinner />
                    <Text type="supporting" color="secondary">
                      Scoring against your profile and gaps…
                    </Text>
                  </div>
                )}

                {!fitnessRunning && !shownFitness && !fitnessError && (
                  <Banner
                    status="info"
                    title={job.posting_text.trim()
                      ? 'Click "Analyze" to run fitness check against your candidate profile.'
                      : "Add the posting text first — the fitness check reads the posting, not the resume."}
                  />
                )}

                {!fitnessRunning && shownFitness && (
                  <FitnessReportView
                    result={shownFitness}
                    runAt={shownFitnessRunAt ? runDate(shownFitnessRunAt).toISOString() : null}
                    model={shownFitnessMethod ? runMethodLabel({ kind: "fitness", method: shownFitnessMethod, resume_name: null }) : null}
                    busy={fitnessSaving}
                    onAddToNotes={() => addFitnessToNotes(false)}
                    onAbandon={() => addFitnessToNotes(true)}
                  />
                )}
              </div>
            </>
          ) : (
            <CandidateProfilePanel onBack={() => setProfileSubTab("score")} />
          )}
        </div>
      )}

      {rightTab === "resume" && (
        <div className="space-y-4">
          {resumeSubTab === "score" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {resumePicker}
                  <Button
                    label="Edit"
                    variant="secondary"
                    size="sm"
                    onClick={() => setResumeSubTab("edit")}
                    isDisabled={!shownMatch}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={withAi}
                      onChange={(e) => {
                        setWithAi(e.target.checked);
                        if (typeof window !== "undefined") {
                          localStorage.setItem("jobWorkspaceWithAi", e.target.checked ? "1" : "0");
                        }
                      }}
                      className="accent-primary rounded cursor-pointer"
                    />
                    <span>with AI</span>
                  </label>
                  <Button
                    label={analyzing ? "Analyzing…" : analyzed ? "Re-run analysis" : "Analyze"}
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (withAi) {
                        runUnifiedAnalysis(true);
                      } else {
                        runAnalysis();
                      }
                    }}
                    isDisabled={analyzing || !job.posting_text.trim() || !resumeText.trim()}
                  />
                </div>
              </div>

              {resumeUploadError && <Banner status="error" title={resumeUploadError} />}

              {runs.match.length > 0 && (
                <RunHistory
                  runs={runs.match}
                  currentRunId={job.match_run_id}
                  viewingRunId={viewedMatch?.id ?? null}
                  outOf={100}
                  onView={(id) => viewRun("match", id)}
                  onMakeCurrent={(id) => makeRunCurrent("match", id)}
                  busy={restoringRun}
                />
              )}

              {shownMatch ? (
                <MatchReportView
                  report={shownMatch.report}
                  aiDetection={viewedMatch ? { status: "done", data: viewedMatch.report.aiDetection } : aiDetection}
                  analysisDisabled={!resumeText.trim() || !job.posting_text.trim()}
                  hasAnalysis={!!shownMatch}
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
          ) : (
            shownMatch ? (
              <ResumeView
                resumeText={shownMatch.resumeText}
                company={job.company}
                jobText={job.posting_text}
                jobTitle={job.title}
                missingSkills={shownMatch.report.highlights.missing}
                aiDetection={viewedMatch ? viewedMatch.report.aiDetection : aiDetection.data}
                materials={materials}
                onMaterialsChange={setMaterials}
                onBack={() => setResumeSubTab("score")}
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
            )
          )}
        </div>
      )}

      {rightTab === "application" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <SegmentedControl
              value={appSubTab}
              onChange={(v) => setAppSubTab(v as AppSubTab)}
              label="Application view"
            >
              <SegmentedControlItem
                value="cover"
                label="Cover letter"
              />
              <SegmentedControlItem
                value="submission"
                label={submissions.length > 0 ? `Submission (${submissions.length})` : "Submission"}
              />
              <SegmentedControlItem
                value="notes"
                label="Notes"
              />
            </SegmentedControl>
          </div>

          {appSubTab === "cover" && (
            analyzed ? (
              <CoverLetterView
                resumeText={analyzed.resumeText}
                jobText={job.posting_text}
                jobTitle={job.title}
                company={job.company}
                materials={materials}
                onMaterialsChange={setMaterials}
              />
            ) : (
              <div className="py-12">
                <Banner
                  status="info"
                  title={job.posting_text.trim()
                    ? 'Select a resume and click "Analyze" to generate a cover letter.'
                    : 'Add a job posting first to generate a cover letter.'}
                />
              </div>
            )
          )}

          {appSubTab === "submission" && (
            <Stack gap={3}>
              <HStack gap={2}>
                <Button label="Upload file" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} />
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
                {analyzed && (
                  <Button
                    label="Save package"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const resume = loadSavedResume();
                      const md = buildPackageMarkdown({
                        company: job.company, jobTitle: job.title, jobUrl: job.url,
                        jobText: job.posting_text, resume, resumeFallbackText: analyzed.resumeText,
                        coverLetter: coverLetterText(),
                        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                      });
                      await fetch(`/api/jobs/${jobId}/submissions`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "package", label: `Application Package — ${new Date().toLocaleDateString()}`, format: "md", content: md }),
                      });
                      fetchJob();
                    }}
                  />
                )}
              </HStack>
              {submissions.length === 0 ? (
                <Banner status="info" title="No submissions yet." />
              ) : (
                <Stack gap={2}>
                  {submissions.map((s) => (
                    <Card key={s.id}>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <Text weight="semibold" display="block">{s.label}</Text>
                            <Text type="supporting" display="block">{s.type} · {s.format}</Text>
                          </div>
                          <HStack gap={2}>
                            {s.content && (
                              <Button
                                label={viewingSubmission === s.id ? "Close" : "View"}
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingSubmission(viewingSubmission === s.id ? null : s.id)}
                              />
                            )}
                            <Button label="Download" variant="ghost" size="sm" href={`/api/jobs/${jobId}/submissions/${s.id}?download=1`} />
                            <Button label="Remove" variant="ghost" size="sm" onClick={() => deleteSubmission(s.id)} />
                          </HStack>
                        </div>
                        {viewingSubmission === s.id && s.content && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="prose prose-sm max-w-none">
                              <Markdown>{s.content}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          {appSubTab === "notes" && (
            <div>
              {editing ? (
                <div>
                  <TextArea label="Notes" isLabelHidden value={editNotes} onChange={setEditNotes} rows={10} />
                  <div className="mt-2 flex gap-2">
                    <Button label="Save" variant="primary" size="sm" onClick={saveNotes} />
                    <Button label="Cancel" variant="secondary" size="sm" onClick={() => setEditing(false)} />
                  </div>
                </div>
              ) : (
                <div>
                  <Button label={job.notes ? "Edit notes" : "Add notes"} variant="secondary" size="sm" onClick={() => { setEditNotes(job.notes); setEditing(true); }} />
                  {job.notes ? (
                    <div className="prose prose-sm mt-3 max-w-none">
                      <Markdown>{job.notes}</Markdown>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Banner status="info" title="No notes yet." />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

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
            <div className="shrink-0 border-b border-border bg-surface px-4">{rightTabBar}</div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4">{rightPaneBody}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative grid h-[calc(100vh-57px)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-surface text-primary"
      style={{ gridTemplateColumns: `${splitPct}% ${100 - splitPct}%` }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="absolute top-0 bottom-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-brand/30 active:bg-brand/50 transition-colors"
        style={{ left: `${splitPct}%`, transform: "translateX(-50%)" }}
      />
      {/* Header */}
      <div className="col-start-1 row-start-1 border-b border-r border-border bg-surface px-4 py-3">
        <div className="flex items-start justify-between gap-3">{jobHeaderInner}</div>
      </div>

      {/* Left tabs */}
      <div className="col-start-1 row-start-2 border-b border-r border-border bg-surface px-4">{leftTabBar}</div>

      {/* Left content */}
      <div className="col-start-1 row-start-3 min-h-0 overflow-y-auto border-r border-border bg-surface p-4">{leftPaneBody}</div>

      {/* Right pane: activity banner, tabs, content */}
      <div className="col-start-2 row-start-1 row-span-3 flex min-h-0 flex-col bg-surface">
        <div className="shrink-0 px-4 pt-3">{activityBanner}</div>
        <div className="shrink-0 border-b border-border px-4 py-3 flex items-center min-h-[57px]">{rightTabBar}</div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 text-xs">{rightPaneBody}</div>
      </div>
    </div>
  );
}

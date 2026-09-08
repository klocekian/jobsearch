"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Markdown from "react-markdown";
import { analyze } from "@/lib/analysis/analyze";
import type { MatchReport } from "@/lib/analysis/types";
import type { ContextMaterial } from "@/lib/context";
import { MatchReportView, type AiDetectionState } from "./MatchReportView";
import { FitnessReportView } from "./FitnessReportView";
import type { FitnessResult } from "@/lib/fitness/schema";
import { renderFitnessText } from "@/lib/fitness/render";
import { JobDescriptionView } from "./JobDescriptionView";
import { ResumeView } from "./ResumeView";
import { CoverLetterView } from "./CoverLetterView";
import { JobStatusDot } from "./icons";
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
import type { JobRow } from "@/lib/db/jobs";
import type { SubmissionRow } from "@/lib/db/submissions";
import { STATUS_OPTIONS } from "@/lib/status";
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

type LeftTab = "posting" | "apply" | "submissions" | "notes";
type RightTab = "fitness" | "report" | "resume" | "cover";
type MobilePane = "posting" | "analysis";

interface SavedResume { id: number; name: string; content: string; is_default: number }

export function JobWorkspace({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>("posting");
  const [rightTab, setRightTab] = useState<RightTab>("fitness");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobilePane, setMobilePane] = useState<MobilePane>("posting");

  // Editing
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editPostingText, setEditPostingText] = useState("");
  const [editingHeader, setEditingHeader] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<number | null>(null);
  const [headerFields, setHeaderFields] = useState({ title: "", company: "", location: "", salary_text: "", url: "" });

  // Paste posting
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Resume / Analysis state
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [analyzed, setAnalyzed] = useState<{ report: MatchReport; resumeText: string; jobText: string } | null>(null);
  const [aiDetection, setAiDetection] = useState<AiDetectionState>({ status: "loading", data: null });
  // Fitness check. `saved` is the report already written to the job; `pending`
  // is a fresh run that has NOT been written yet — the panel renders and waits
  // for an explicit Save, so a run never mutates the job on its own.
  const [fitnessRunModel, setFitnessRunModel] = useState<string | null>(null);
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
  const [materials, setMaterials] = useState<ContextMaterial[]>(() => loadContextMaterials());
  const fileRef = useRef<HTMLInputElement>(null);
  const resumeFileRef = useRef<HTMLInputElement>(null);
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveContextMaterials(materials); }, [materials]);

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) { setLoading(false); return; }
    const data: { job: JobRow; submissions: SubmissionRow[] } = await res.json();
    setJob(data.job);
    setSubmissions(data.submissions);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  // Load saved resumes and auto-select default
  useEffect(() => {
    fetch("/api/resumes").then(r => r.json()).then((d: { resumes?: SavedResume[] }) => {
      const list = d.resumes ?? [];
      setSavedResumes(list);
      if (!resumeText && list.length > 0) {
        const def = list.find(r => r.is_default) ?? list[0];
        setResumeText(def.content);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing match report if available (wait for resumeText to load)
  useEffect(() => {
    if (!job || !resumeText) return;
    if (job.match_report && job.posting_text) {
      setAnalyzed(prev => {
        if (prev) return prev;
        try {
          const report = JSON.parse(job.match_report!) as MatchReport;
          return { report, resumeText, jobText: job.posting_text! };
        } catch { return prev; }
      });
    }
  }, [job?.id, resumeText]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI detection
  useEffect(() => {
    if (!analyzed) return;
    const text = analyzed.resumeText;
    const fallback = analyzed.report.aiDetection;
    const cached = loadAiDetection(text);
    if (cached) { setAiDetection({ status: "done", data: cached }); return; }
    setAiDetection({ status: "loading", data: fallback });
    let active = true;
    fetch("/api/ai-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: text }),
    }).then(r => r.json()).then((d: { confidence?: number; patterns?: unknown }) => {
      if (!active) return;
      if (typeof d.confidence === "number" && Array.isArray(d.patterns)) {
        const det = d as unknown as import("@/lib/analysis/types").AiDetection;
        saveAiDetection(text, det);
        setAiDetection({ status: "done", data: det });
      } else {
        setAiDetection({ status: "error", data: fallback });
      }
    }).catch(() => { if (active) setAiDetection({ status: "error", data: fallback }); });
    return () => { active = false; };
  }, [analyzed]);

  const runAnalysis = () => {
    if (!job || !resumeText.trim() || !job.posting_text.trim()) return;
    if (!analyzed || analyzed.jobText !== job.posting_text) {
      clearCoverLetter();
      clearRewrite();
    }
    const report = analyze({
      resumeText, jobText: job.posting_text,
      company: job.company, jobTitle: job.title, jobUrl: job.url, fileName: "",
    });
    setAnalyzed({ report, resumeText, jobText: job.posting_text });
    setRightTab("report");
    const selectedResume = savedResumes.find(r => r.content === resumeText);
    fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_score: report.score,
        match_report: JSON.stringify(report),
        // Record which resume produced the score, so the ATS number reads as a
        // fact about a document rather than a verdict on the job.
        match_resume_name: selectedResume?.name ?? null,
      }),
    }).catch(() => {});
    if (selectedResume && job.company) {
      fetch(`/api/resumes/${selectedResume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_tag: job.company }),
      }).catch(() => {});
    }
  };

  const runFitnessCheck = async () => {
    if (!job || !job.posting_text.trim()) return;
    setFitnessRunning(true);
    setFitnessError(null);
    setNotesFlash(false);
    setRightTab("fitness");
    try {
      const res = await fetch("/api/fitness-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await res.json() as {
        result?: FitnessResult; text?: string; model?: string; run_at?: string; error?: string;
      };
      if (!res.ok || !data.result) {
        setFitnessError(data.error ?? "Fitness check failed.");
        return;
      }
      setFitnessRunModel(data.model ?? null);

      // Persist on completion, the same way runAnalysis persists the ATS
      // report: the run is paid for, so it is kept. Re-running overwrites,
      // which is what you want when checking against a different resume.
      // The DECISION stays manual — notes and status still need a button.
      const runAt = data.run_at ?? new Date().toISOString();
      const saveRes = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fitness_score: data.result.score,
          fitness_report: JSON.stringify(data.result),
          fitness_run_at: runAt,
        }),
      });
      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({})) as { error?: string };
        setFitnessError(d.error ?? `Report ran but could not be saved (${saveRes.status}).`);
      }
      await fetchJob();
    } catch {
      setFitnessError("Fitness check failed.");
    } finally {
      setFitnessRunning(false);
    }
  };

  /**
   * Writing the report into the job's notes, and abandoning the job, stay
   * behind explicit presses. Persisting the report is bookkeeping; these two
   * are decisions, and automating a decision is how you stop reading the
   * report that informs it.
   */
  const addFitnessToNotes = async (alsoAbandon: boolean) => {
    if (!job || !fitnessSaved) return;
    setFitnessSaving(true);
    const stamp = job.fitness_run_at ? new Date(job.fitness_run_at).toLocaleString() : new Date().toLocaleString();
    const header = `--- Fitness check · ${stamp}` +
      `${fitnessRunModel ? ` · ${fitnessRunModel}` : ""} ---`;
    const body = [header, renderFitnessText(fitnessSaved)].filter(Boolean).join("\n");
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

  const updateStatus = async (newStatus: string) => {
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
  };

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

  const deleteJob = async () => {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    router.push("/jobs");
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
    <>
      <div className="min-w-0 flex-1">
        <AstryxLink href="/jobs">← All jobs</AstryxLink>
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
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Selector
          label="Status"
          isLabelHidden
          size="sm"
          startIcon={<JobStatusDot status={job.status} />}
          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, icon: <JobStatusDot status={s.value} /> }))}
          value={job.status}
          onChange={(v) => updateStatus(v as string)}
        />
        <Button label="Delete" variant="destructive" size="sm" onClick={deleteJob} />
      </div>
    </>
  );

  const leftTabBar = (
    <TabList value={leftTab} onChange={(v) => setLeftTab(v as LeftTab)}>
      <Tab value="posting" label="Job Posting" />
      <Tab value="apply" label="Apply" />
      <Tab value="submissions" label={`Submissions (${submissions.length})`} />
      <Tab value="notes" label="Notes" />
    </TabList>
  );

  const leftPaneBody = (
    <>
      {leftTab === "posting" && (
            <div className="space-y-3">
              {!pasting && (
                <div className="flex items-center gap-2">
                  <Button label={job.posting_text ? "Update posting" : "Paste posting"} variant="secondary" size="sm" onClick={() => setPasting(true)} />
                  {job.url && (
                    <AstryxLink href={job.url} isExternalLink>Open original</AstryxLink>
                  )}
                </div>
              )}
              {pasting && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                  />
                ) : (
                  <Text display="block" className="whitespace-pre-wrap leading-relaxed">{job.posting_text}</Text>
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
                <iframe src={job.url} className="flex-1 w-full rounded-lg border border-slate-200" title="Application" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
              </div>
            ) : (
              <Banner status="info" title="No URL saved for this job. Add one to open the application here." />
            )
          )}

          {leftTab === "submissions" && (
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
                            <div className="prose prose-sm prose-slate max-w-none">
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

          {leftTab === "notes" && (
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
                    <div className="prose prose-sm prose-slate mt-3 max-w-none">
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
    </>
  );

  const resumeControls = (
    <>
            <div className="min-w-0">
              <Text type="supporting" display="block">Resume</Text>
              <div className="mt-1 flex items-center gap-2">
                {savedResumes.length > 0 && (
                  <Selector
                    label="Resume"
                    isLabelHidden
                    className="max-w-[220px]"
                    options={savedResumes.map(r => ({ value: String(r.id), label: `${r.name}${r.is_default ? " (default)" : ""}` }))}
                    value={String(savedResumes.find(r => r.content === resumeText)?.id ?? "")}
                    onChange={(v) => {
                      const r = savedResumes.find(r => r.id === Number(v));
                      if (r) setResumeText(r.content);
                    }}
                  />
                )}
                <input
                  ref={resumeFileRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.pdf,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const name = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
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
                    e.target.value = "";
                  }}
                />
                <Button label="+ Add" variant="secondary" size="sm" onClick={() => resumeFileRef.current?.click()} />
              </div>
              <Text type="supporting" display="block" className="mt-1">
                {analyzed
                  ? <>Score: <Text weight="semibold">{analyzed.report.score}</Text>/100</>
                  : "Select a resume and run analysis"
                }
              </Text>
            </div>
            {!analyzed && (
              <div className="flex shrink-0 items-center gap-2">
                <Button label="Run analysis" variant="primary" size="sm" onClick={runAnalysis} isDisabled={!resumeText.trim() || !job.posting_text.trim()} />
              </div>
            )}
    </>
  );

  const rightTabBar = (
    <TabList value={rightTab} onChange={(v) => setRightTab(v as RightTab)}>
      <Tab value="fitness" label={fitnessSaved ? `Fitness (${fitnessSaved.score}/10)` : "Fitness"} />
      <Tab value="report" label="ATS Report" />
      <Tab value="resume" label="Resume" />
      <Tab value="cover" label="Cover Letter" />
    </TabList>
  );

  const rightPaneBody = (
    <>
          {rightTab === "fitness" && (
            <div className="py-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  label={fitnessRunning ? "Running…" : fitnessSaved ? "Re-run fitness check" : "Run fitness check"}
                  variant="primary"
                  size="sm"
                  onClick={runFitnessCheck}
                  isDisabled={fitnessRunning || !job.posting_text.trim()}
                />
                {job.fitness_run_at && !fitnessRunning && (
                  <Text type="supporting" color="secondary">
                    Last run {new Date(job.fitness_run_at).toLocaleString()}
                  </Text>
                )}
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

              {!fitnessRunning && !fitnessSaved && !fitnessError && (
                <Banner
                  status="info"
                  title={job.posting_text.trim()
                    ? "Run a fitness check to score this posting against your profile."
                    : "Add the posting text first — the fitness check reads the posting, not the resume."}
                />
              )}

              {!fitnessRunning && fitnessSaved && (
                <FitnessReportView
                  result={fitnessSaved}
                  runAt={job.fitness_run_at}
                  model={fitnessRunModel}
                  busy={fitnessSaving}
                  onAddToNotes={() => addFitnessToNotes(false)}
                  onAbandon={() => addFitnessToNotes(true)}
                />
              )}
            </div>
          )}

          {rightTab !== "fitness" && !analyzed && !job.posting_text && (
            <div className="py-12">
              <Banner status="info" title="Add a job posting and run analysis to see results here." />
            </div>
          )}
          {rightTab !== "fitness" && !analyzed && job.posting_text && (
            <div className="py-12">
              <Banner status="info" title={'Click "Run analysis" to match your resume against this posting.'} />
            </div>
          )}

          {analyzed && rightTab === "report" && (
            <MatchReportView
              report={analyzed.report}
              aiDetection={aiDetection}
              onRunAnalysis={runAnalysis}
              analysisDisabled={!resumeText.trim() || !job.posting_text.trim()}
              hasAnalysis={!!analyzed}
            />
          )}
          {analyzed && rightTab === "resume" && (
            <ResumeView
              resumeText={analyzed.resumeText}
              company={job.company}
              jobText={job.posting_text}
              jobTitle={job.title}
              missingSkills={analyzed.report.highlights.missing}
              aiDetection={aiDetection.data}
              materials={materials}
              onMaterialsChange={setMaterials}
            />
          )}
          {analyzed && rightTab === "cover" && (
            <CoverLetterView
              resumeText={analyzed.resumeText}
              jobText={job.posting_text}
              jobTitle={job.title}
              company={job.company}
              materials={materials}
              onMaterialsChange={setMaterials}
            />
          )}
    </>
  );

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-57px)] flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">{jobHeaderInner}</div>
        </div>
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2">
          <SegmentedControl value={mobilePane} onChange={(v) => setMobilePane(v as MobilePane)} label="View">
            <SegmentedControlItem value="posting" label="Posting" />
            <SegmentedControlItem value="analysis" label="Analysis" />
          </SegmentedControl>
        </div>
        {mobilePane === "posting" ? (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-white px-4">{leftTabBar}</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{leftPaneBody}</div>
          </>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">{resumeControls}</div>
            </div>
            <div className="shrink-0 border-b border-slate-200 bg-white px-4">{rightTabBar}</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{rightPaneBody}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative grid h-[calc(100vh-57px)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden"
      style={{ gridTemplateColumns: `${splitPct}% ${100 - splitPct}%` }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="absolute top-0 bottom-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-brand/30 active:bg-brand/50 transition-colors"
        style={{ left: `${splitPct}%`, transform: "translateX(-50%)" }}
      />
      {/* Header */}
      <div className="col-start-1 row-start-1 border-b border-r border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">{jobHeaderInner}</div>
      </div>

      {/* Left tabs */}
      <div className="col-start-1 row-start-2 border-b border-r border-slate-200 bg-white px-4">{leftTabBar}</div>

      {/* Left content */}
      <div className="col-start-1 row-start-3 min-h-0 overflow-y-auto border-r border-slate-200 p-4">{leftPaneBody}</div>

      {/* Analysis controls */}
      <div className="col-start-2 row-start-1 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">{resumeControls}</div>
      </div>

      {/* Right tabs */}
      <div className="col-start-2 row-start-2 border-b border-slate-200 bg-white px-4">{rightTabBar}</div>

      {/* Right content */}
      <div className="col-start-2 row-start-3 min-h-0 overflow-y-auto p-4">{rightPaneBody}</div>
    </div>
  );
}

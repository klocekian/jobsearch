"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { analyze } from "@/lib/analysis/analyze";
import type { MatchReport } from "@/lib/analysis/types";
import type { ContextMaterial } from "@/lib/context";
import { MatchReportView, type AiDetectionState } from "./MatchReportView";
import { JobDescriptionView } from "./JobDescriptionView";
import { ResumeView } from "./ResumeView";
import { CoverLetterView } from "./CoverLetterView";
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
import { STATUS_OPTIONS, STATUS_COLORS } from "@/lib/status";

type LeftTab = "posting" | "apply" | "submissions" | "notes";
type RightTab = "report" | "resume" | "cover";

interface SavedResume { id: number; name: string; content: string; is_default: number }

export function JobWorkspace({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>("posting");
  const [rightTab, setRightTab] = useState<RightTab>("report");

  // Editing
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editPostingText, setEditPostingText] = useState("");
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerFields, setHeaderFields] = useState({ title: "", company: "", location: "", salary_text: "", url: "" });

  // Paste posting
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Resume / Analysis state
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [analyzed, setAnalyzed] = useState<{ report: MatchReport; resumeText: string; jobText: string } | null>(null);
  const [aiDetection, setAiDetection] = useState<AiDetectionState>({ status: "loading", data: null });
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
    fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_score: report.score, match_report: JSON.stringify(report) }),
    }).catch(() => {});
    const selectedResume = savedResumes.find(r => r.content === resumeText);
    if (selectedResume && job.company) {
      fetch(`/api/resumes/${selectedResume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_tag: job.company }),
      }).catch(() => {});
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

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Loading…</p>;
  if (!job) return <p className="py-12 text-center text-sm text-slate-500">Job not found.</p>;

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link href="/jobs" className="text-xs text-slate-400 hover:text-slate-600">← All jobs</Link>
              {editingHeader ? (
                <div className="mt-1 space-y-1.5">
                  <input className="input text-sm font-bold" value={headerFields.title} onChange={(e) => setHeaderFields(f => ({ ...f, title: e.target.value }))} placeholder="Job title" autoFocus />
                  <div className="flex gap-1.5">
                    <input className="input text-xs" value={headerFields.company} onChange={(e) => setHeaderFields(f => ({ ...f, company: e.target.value }))} placeholder="Company" />
                    <input className="input text-xs" value={headerFields.location} onChange={(e) => setHeaderFields(f => ({ ...f, location: e.target.value }))} placeholder="Location" />
                  </div>
                  <div className="flex gap-1.5">
                    <input className="input text-xs" value={headerFields.salary_text} onChange={(e) => setHeaderFields(f => ({ ...f, salary_text: e.target.value }))} placeholder="Salary" />
                    <input className="input text-xs" value={headerFields.url} onChange={(e) => setHeaderFields(f => ({ ...f, url: e.target.value }))} placeholder="URL" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={saveHeader} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark">Save</button>
                    <button onClick={() => setEditingHeader(false)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {job.title || "Untitled"}
                    <button
                      onClick={() => { setHeaderFields({ title: job.title, company: job.company, location: job.location, salary_text: job.salary_text, url: job.url }); setEditingHeader(true); }}
                      className="ml-2 text-xs font-normal text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-500 transition-opacity"
                    >Edit</button>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {job.company}
                    {job.location && <span> · {job.location}</span>}
                    {job.salary_text && <span> · {job.salary_text}</span>}
                  </p>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={job.status}
                onChange={(e) => updateStatus(e.target.value)}
                className={`rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize ${STATUS_COLORS[job.status] ?? ""}`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button onClick={deleteJob} className="text-xs text-rose-400 hover:text-rose-600">Delete</button>
            </div>
          </div>
        </div>

        {/* Left tabs */}
        <div className="col-start-1 row-start-2 flex border-b border-r border-slate-200 bg-white px-4">
          {([
            ["posting", "Job Posting"],
            ["apply", "Apply"],
            ["submissions", `Submissions (${submissions.length})`],
            ["notes", "Notes"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLeftTab(key as LeftTab)}
              className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition ${
                leftTab === key ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Left content */}
        <div className="col-start-1 row-start-3 min-h-0 overflow-y-auto border-r border-slate-200 p-4">
          {leftTab === "posting" && (
            <div className="space-y-3">
              {!pasting && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPasting(true)} className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50">
                    {job.posting_text ? "Update posting" : "Paste posting"}
                  </button>
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand hover:underline">
                      Open original ↗
                    </a>
                  )}
                </div>
              )}
              {pasting && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <textarea className="input h-32 resize-y font-mono text-xs" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste job posting text…" autoFocus />
                  <div className="mt-2 flex gap-2">
                    <button onClick={pasteDirect} disabled={!pasteText.trim()} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50">Save</button>
                    <button onClick={() => { setPasting(false); setPasteText(""); }} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
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
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.posting_text}</pre>
                )
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">No posting text. Paste it above or use the Chrome extension.</p>
              )}
            </div>
          )}

          {leftTab === "apply" && (
            job.url ? (
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                    Open in new tab ↗
                  </a>
                  <span className="text-[10px] text-slate-400">Many sites block embedding — use the link above if the form doesn&apos;t load below.</span>
                </div>
                <iframe src={job.url} className="flex-1 w-full rounded-lg border border-slate-200" title="Application" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No URL saved for this job. Add one to open the application here.</p>
            )
          )}

          {leftTab === "submissions" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50">Upload file</button>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
                {analyzed && (
                  <button
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
                    className="rounded-md border border-emerald-300 px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    Save package
                  </button>
                )}
              </div>
              {submissions.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No submissions yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {submissions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{s.label}</p>
                        <p className="text-[10px] text-slate-400">{s.type} · {s.format}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`/api/jobs/${jobId}/submissions/${s.id}?download=1`} className="text-[10px] font-medium text-brand hover:underline">Download</a>
                        <button onClick={() => deleteSubmission(s.id)} className="text-[10px] text-rose-400 hover:text-rose-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {leftTab === "notes" && (
            <div>
              {editing ? (
                <div>
                  <textarea className="input h-48 resize-y text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} autoFocus />
                  <div className="mt-2 flex gap-2">
                    <button onClick={saveNotes} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark">Save</button>
                    <button onClick={() => setEditing(false)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => { setEditNotes(job.notes); setEditing(true); }} className="mb-3 rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50">
                    {job.notes ? "Edit notes" : "Add notes"}
                  </button>
                  {job.notes ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.notes}</pre>
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-400">No notes yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analysis controls */}
        <div className="col-start-2 row-start-1 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Resume</p>
              <div className="mt-1 flex items-center gap-2">
                {savedResumes.length > 0 && (
                  <select
                    className="input max-w-[220px] text-sm font-medium"
                    value={savedResumes.find(r => r.content === resumeText)?.id ?? ""}
                    onChange={(e) => {
                      const r = savedResumes.find(r => r.id === Number(e.target.value));
                      if (r) setResumeText(r.content);
                    }}
                  >
                    {savedResumes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
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
                <button
                  onClick={() => resumeFileRef.current?.click()}
                  className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
                >
                  + Add
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {analyzed
                  ? <>Score: <span className="font-semibold text-slate-700">{analyzed.report.score}</span>/100</>
                  : "Select a resume and run analysis"
                }
              </p>
            </div>
            {!analyzed && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={runAnalysis}
                  disabled={!resumeText.trim() || !job.posting_text.trim()}
                  className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  Run analysis
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right tabs */}
        <div className="col-start-2 row-start-2 flex border-b border-slate-200 bg-white px-4">
          {([
            ["report", "Report"],
            ["resume", "Resume"],
            ["cover", "Cover Letter"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRightTab(key as RightTab)}
              className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition ${
                rightTab === key ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="col-start-2 row-start-3 min-h-0 overflow-y-auto p-4">
          {!analyzed && !job.posting_text && (
            <p className="py-12 text-center text-sm text-slate-400">Add a job posting and run analysis to see results here.</p>
          )}
          {!analyzed && job.posting_text && (
            <p className="py-12 text-center text-sm text-slate-400">Click &ldquo;Run analysis&rdquo; to match your resume against this posting.</p>
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
        </div>
    </div>
  );
}

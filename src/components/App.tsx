"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyze } from "@/lib/analysis/analyze";
import { extractFileText, isSupportedFile, SUPPORTED_FORMATS } from "@/lib/extract";
import type { MatchReport } from "@/lib/analysis/types";
import type { ContextMaterial } from "@/lib/context";
import { MatchReportView, type AiDetectionState } from "./MatchReportView";
import { JobDescriptionView } from "./JobDescriptionView";
import { ResumeView } from "./ResumeView";
import { CoverLetterView } from "./CoverLetterView";
import { buildPackageMarkdown, packageFileName, downloadTextFile } from "@/lib/package";
import {
  loadSavedResume,
  coverLetterText,
  clearCoverLetter,
  clearRewrite,
  loadContextMaterials,
  saveContextMaterials,
  loadSession,
  saveSession,
  loadAiDetection,
  saveAiDetection,
} from "@/lib/storage";

type Tab = "report" | "job" | "resume" | "cover";

interface AnalyzedState {
  report: MatchReport;
  resumeText: string;
  jobText: string;
}

export function App() {
  const searchParams = useSearchParams();
  const linkedJobId = searchParams.get("jobId");

  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  // Set only when a PDF is uploaded; drives the File Type ATS check.
  const [fileName, setFileName] = useState("");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const [analyzed, setAnalyzed] = useState<AnalyzedState | null>(null);
  const [tab, setTab] = useState<Tab>("report");

  // Candidate-level context materials, shared by the Resume (suggestions) and
  // Cover Letter tabs. Read from storage via a lazy initializer (client-only —
  // the materials aren't rendered until after analysis, so no SSR mismatch),
  // then persisted on every change.
  const [materials, setMaterials] = useState<ContextMaterial[]>(() => loadContextMaterials());
  useEffect(() => {
    saveContextMaterials(materials);
  }, [materials]);

  // Load from a linked job (via ?jobId=N) or restore the session from
  // localStorage. Done in an effect to avoid SSR hydration mismatch.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (linkedJobId) {
      fetch(`/api/jobs/${linkedJobId}`)
        .then((r) => r.json())
        .then((data: { job?: { id: number; company: string; title: string; url: string; posting_text: string } }) => {
          if (data.job) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setCompany(data.job.company);
            setJobTitle(data.job.title);
            setJobUrl(data.job.url);
            setJobText(data.job.posting_text);
            setActiveJobId(data.job.id);
            /* eslint-enable react-hooks/set-state-in-effect */
          }
          setHydrated(true);
        })
        .catch(() => setHydrated(true));
      return;
    }
    const s = loadSession();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    if (s) {
      setCompany(s.company);
      setJobTitle(s.jobTitle);
      setJobUrl(s.jobUrl);
      setFileName(s.fileName);
      setResumeText(s.resumeText);
      setJobText(s.jobText);
      if (s.analyzed) {
        setAnalyzed({
          report: analyze(s.analyzed),
          resumeText: s.analyzed.resumeText,
          jobText: s.analyzed.jobText,
        });
        setTab(s.tab as Tab);
      }
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the session on every change (after hydration, so we never overwrite
  // the saved session with the initial empty state before it is restored).
  useEffect(() => {
    if (!hydrated) return;
    saveSession({
      company,
      jobTitle,
      jobUrl,
      fileName,
      resumeText,
      jobText,
      tab,
      analyzed: analyzed
        ? {
            resumeText: analyzed.resumeText,
            jobText: analyzed.jobText,
            company: analyzed.report.meta.company,
            jobTitle: analyzed.report.meta.jobTitle,
            jobUrl: analyzed.report.meta.jobUrl,
            fileName: analyzed.report.meta.fileName,
          }
        : null,
    });
  }, [hydrated, company, jobTitle, jobUrl, fileName, resumeText, jobText, tab, analyzed]);

  const [pdfStatus, setPdfStatus] = useState<{ kind: "idle" | "loading" | "error" | "done"; message?: string }>({
    kind: "idle",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fetchStatus, setFetchStatus] = useState<{ kind: "idle" | "loading" | "error" | "done"; message?: string }>({
    kind: "idle",
  });

  // Job picker dropdown — loads from the local SQLite database.
  interface TrackerJob { id: number; company: string; title: string; status: string; url: string; posting_text: string }
  const [trackerJobs, setTrackerJobs] = useState<TrackerJob[]>([]);
  const [trackerStatus, setTrackerStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [trackerOpen, setTrackerOpen] = useState(false);
  const trackerRef = useRef<HTMLDivElement>(null);

  const loadTracker = useCallback(async () => {
    setTrackerStatus("loading");
    try {
      const res = await fetch("/api/jobs?sort=created_at&order=desc");
      const data: { jobs?: TrackerJob[] } = await res.json();
      if (!res.ok || !data.jobs) throw new Error("Failed to load.");
      setTrackerJobs(data.jobs);
      setTrackerStatus("done");
      setTrackerOpen(true);
    } catch {
      setTrackerStatus("error");
    }
  }, []);

  const pickJob = (job: TrackerJob) => {
    setCompany(job.company);
    setJobTitle(job.title);
    if (job.url) setJobUrl(job.url);
    if (job.posting_text) setJobText(job.posting_text);
    setActiveJobId(job.id);
    setTrackerOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (trackerRef.current && !trackerRef.current.contains(e.target as Node)) setTrackerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchFromUrl = async () => {
    if (!jobUrl.trim()) return;
    setFetchStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/fetch-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl.trim() }),
      });
      const data: { company?: string; jobTitle?: string; jobDescription?: string; error?: string } =
        await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      if (data.company) setCompany(data.company);
      if (data.jobTitle) setJobTitle(data.jobTitle);
      if (data.jobDescription) setJobText(data.jobDescription);
      setFetchStatus({ kind: "done", message: "Filled from posting — review and edit as needed." });
    } catch (err: unknown) {
      setFetchStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't fetch this posting. Paste it below instead.",
      });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedFile(file)) {
      setPdfStatus({ kind: "error", message: `Unsupported file. Upload a ${SUPPORTED_FORMATS} file.` });
      return;
    }
    setPdfStatus({ kind: "loading" });
    try {
      const { text, pages } = await extractFileText(file);
      if (!text.trim()) {
        setPdfStatus({
          kind: "error",
          message: "No selectable text found — if this is a scanned PDF, paste the text instead.",
        });
        return;
      }
      setResumeText(text);
      setFileName(file.name);
      const detail = pages ? ` (${pages} page${pages === 1 ? "" : "s"})` : "";
      setPdfStatus({ kind: "done", message: `Loaded ${file.name}${detail}.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to read the file.";
      setPdfStatus({ kind: "error", message });
    }
  };

  // LLM-based AI-authorship check for the analyzed resume. Heuristic
  // (analyzed.report.aiDetection) is the fallback while loading / on failure.
  const [aiDetection, setAiDetection] = useState<AiDetectionState>({ status: "loading", data: null });
  useEffect(() => {
    if (!analyzed) return;
    const text = analyzed.resumeText;
    const fallback = analyzed.report.aiDetection;
    const cached = loadAiDetection(text);
    /* eslint-disable react-hooks/set-state-in-effect -- initial status from cache/loading; the result is set asynchronously */
    if (cached) {
      setAiDetection({ status: "done", data: cached });
      return;
    }
    setAiDetection({ status: "loading", data: fallback });
    /* eslint-enable react-hooks/set-state-in-effect */
    let active = true;
    fetch("/api/ai-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: text }),
    })
      .then((r) => r.json())
      .then((d: { confidence?: number; band?: string; patterns?: unknown; error?: string }) => {
        if (!active) return;
        if (typeof d.confidence === "number" && Array.isArray(d.patterns)) {
          const det = d as unknown as import("@/lib/analysis/types").AiDetection;
          saveAiDetection(text, det);
          setAiDetection({ status: "done", data: det });
        } else {
          throw new Error(d.error ?? "Unexpected response.");
        }
      })
      .catch(() => {
        if (active) setAiDetection({ status: "error", data: fallback });
      });
    return () => {
      active = false;
    };
  }, [analyzed]);

  const runAnalysis = () => {
    if (!resumeText.trim() || !jobText.trim()) return;
    if (!analyzed || analyzed.jobText !== jobText) {
      clearCoverLetter();
      clearRewrite();
    }
    const report = analyze({ resumeText, jobText, company, jobTitle, jobUrl, fileName });
    setAnalyzed({ report, resumeText, jobText });
    setTab("report");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    if (activeJobId) {
      fetch(`/api/jobs/${activeJobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_score: report.score,
          match_report: JSON.stringify(report),
        }),
      }).catch(() => {});
    }
  };

  const downloadPackage = () => {
    if (!analyzed) return;
    const resume = loadSavedResume();
    const markdown = buildPackageMarkdown({
      company: analyzed.report.meta.company,
      jobTitle: analyzed.report.meta.jobTitle,
      jobUrl: analyzed.report.meta.jobUrl,
      jobText: analyzed.jobText,
      resume,
      resumeFallbackText: analyzed.resumeText,
      coverLetter: coverLetterText(),
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    });
    downloadTextFile(packageFileName({ company: analyzed.report.meta.company, resume }), markdown);
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Resume Match Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyze how well a resume positions a candidate for a specific role, calibrated to the
          criteria Applicant Tracking Systems use.
        </p>
        {activeJobId && (
          <p className="mt-2 text-xs text-brand">
            Linked to saved job — results will be saved automatically.{" "}
            <a href={`/jobs/${activeJobId}`} className="underline hover:no-underline">View job →</a>
          </p>
        )}
      </header>

      {/* Input form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {/* Job picker */}
          <div className="relative flex items-center gap-2" ref={trackerRef}>
            <button
              type="button"
              onClick={() => (trackerStatus === "done" ? setTrackerOpen(!trackerOpen) : loadTracker())}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              {trackerStatus === "loading" ? "Loading…" : "Load from saved jobs"}
            </button>
            {trackerStatus === "error" && (
              <span className="text-xs text-rose-500">Failed to load jobs.</span>
            )}
            {trackerOpen && trackerJobs.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {trackerJobs
                  .filter((j) => j.status !== "closed")
                  .map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => pickJob(job)}
                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{job.company}</span>
                    <span className="text-slate-500">{job.title}</span>
                    {job.status && (
                      <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                        job.status === "interview" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {job.status}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company">
              <input
                className="input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Google"
              />
            </Field>
            <Field label="Job Title">
              <input
                className="input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Director, User Experience"
              />
            </Field>
          </div>
          <Field label="Job Posting URL (optional)">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://careers.example.com/job/12345"
              />
              <button
                type="button"
                onClick={fetchFromUrl}
                disabled={!jobUrl.trim() || fetchStatus.kind === "loading"}
                title="Fetch the posting and fill in the company, title, and description"
                className="shrink-0 rounded-lg border border-brand px-4 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fetchStatus.kind === "loading" ? "Fetching…" : "Fetch"}
              </button>
              <a
                href={jobUrl.trim() || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!jobUrl.trim()) e.preventDefault(); }}
                className={`shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 ${!jobUrl.trim() ? "pointer-events-none opacity-50" : ""}`}
              >
                Open ↗
              </a>
            </div>
            {fetchStatus.kind === "done" && (
              <span className="mt-1 block text-xs text-emerald-600">{fetchStatus.message}</span>
            )}
            {fetchStatus.kind === "error" && (
              <span className="mt-1 block text-xs text-rose-500">{fetchStatus.message}</span>
            )}
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Resume (upload PDF / DOCX / text, or paste)">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files[0]);
              }}
              className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2"
            >
              <span className="text-xs text-slate-500">
                Drop a PDF, DOCX, .txt or .md here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-brand hover:underline"
                >
                  browse
                </button>
              </span>
              {pdfStatus.kind === "loading" && (
                <span className="text-xs text-slate-500">Extracting…</span>
              )}
              {pdfStatus.kind === "done" && (
                <span className="text-xs text-emerald-600">{pdfStatus.message}</span>
              )}
              {pdfStatus.kind === "error" && (
                <span className="text-xs text-rose-500">{pdfStatus.message}</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>
            <textarea
              className="input h-56 resize-y font-mono text-xs leading-relaxed"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Upload a file above, or paste your resume text here…"
            />
          </Field>
          <Field label="Job Description (paste text)">
            <textarea
              className="input h-56 resize-y font-mono text-xs leading-relaxed"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the full job posting here…"
            />
          </Field>
        </div>

        <button
          onClick={runAnalysis}
          disabled={!resumeText.trim() || !jobText.trim()}
          className="mt-4 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzed ? "Re-run analysis" : "Analyze resume"}
        </button>
      </section>

      {/* Results */}
      {analyzed && (
        <div className="mt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
            <div className="flex gap-1">
              <TabButton active={tab === "report"} onClick={() => setTab("report")}>
                Resume Report
              </TabButton>
              <TabButton active={tab === "job"} onClick={() => setTab("job")}>
                Job Description
              </TabButton>
              <TabButton active={tab === "resume"} onClick={() => setTab("resume")}>
                Resume
              </TabButton>
              <TabButton active={tab === "cover"} onClick={() => setTab("cover")}>
                Cover Letter
              </TabButton>
            </div>
            <div className="flex gap-2">
              {activeJobId && (
                <button
                  onClick={async () => {
                    const resume = loadSavedResume();
                    const md = buildPackageMarkdown({
                      company: analyzed.report.meta.company,
                      jobTitle: analyzed.report.meta.jobTitle,
                      jobUrl: analyzed.report.meta.jobUrl,
                      jobText: analyzed.jobText,
                      resume,
                      resumeFallbackText: analyzed.resumeText,
                      coverLetter: coverLetterText(),
                      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                    });
                    await fetch(`/api/jobs/${activeJobId}/submissions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "package",
                        label: `Application Package — ${new Date().toLocaleDateString()}`,
                        format: "md",
                        content: md,
                      }),
                    });
                    alert("Saved to job submissions.");
                  }}
                  className="mb-1.5 rounded-md border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                >
                  Save to job
                </button>
              )}
              <button
                onClick={downloadPackage}
                title="Download date, posting link, resume, job posting, and cover letter as one Markdown file"
                className="mb-1.5 rounded-md border border-brand px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white"
              >
                Download .md
              </button>
            </div>
          </div>

          {tab === "report" && <MatchReportView report={analyzed.report} aiDetection={aiDetection} />}
          {tab === "job" && (
            <JobDescriptionView
              jobText={analyzed.jobText}
              jobTitle={analyzed.report.meta.jobTitle}
              matched={analyzed.report.highlights.matched}
              missing={analyzed.report.highlights.missing}
            />
          )}
          {tab === "resume" && (
            <ResumeView
              resumeText={analyzed.resumeText}
              company={analyzed.report.meta.company}
              jobText={analyzed.jobText}
              jobTitle={analyzed.report.meta.jobTitle}
              missingSkills={analyzed.report.highlights.missing}
              aiDetection={aiDetection.data}
              materials={materials}
              onMaterialsChange={setMaterials}
            />
          )}
          {tab === "cover" && (
            <CoverLetterView
              resumeText={analyzed.resumeText}
              jobText={analyzed.jobText}
              jobTitle={analyzed.report.meta.jobTitle}
              company={analyzed.report.meta.company}
              materials={materials}
              onMaterialsChange={setMaterials}
            />
          )}
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-brand text-brand"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

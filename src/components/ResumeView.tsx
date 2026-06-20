"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { parseResume } from "@/lib/resume/parse";
import type { ResumeData } from "@/lib/resume/types";
import { downloadResumePdf } from "@/lib/pdf/resume";
import { RESUME_STORAGE_KEY, isResumeData, loadRewriteState, saveRewriteState } from "@/lib/storage";
import { ContextMaterialsPanel } from "./ContextMaterialsPanel";
import { RewriteEditor } from "./RewriteEditor";
import { combinedContextText, type ContextMaterial } from "@/lib/context";
import type { AiDetection } from "@/lib/analysis/types";

interface ResumeViewProps {
  /** The analyzed resume text — the starting point ("original"). */
  resumeText: string;
  company: string;
  jobText: string;
  jobTitle: string;
  /** Skills the job wants that the analyzer didn't find — fed to the rewrite. */
  missingSkills: string[];
  /** AI-authorship tells detected, so the rewrite can target and remove them. */
  aiDetection: AiDetection | null;
  materials: ContextMaterial[];
  onMaterialsChange: (materials: ContextMaterial[]) => void;
}

type Status = { kind: "idle" | "loading" | "error"; message?: string };

export function ResumeView({
  resumeText,
  company,
  jobText,
  jobTitle,
  missingSkills,
  aiDetection,
  materials,
  onMaterialsChange,
}: ResumeViewProps) {
  const original = resumeText;
  const saved = useMemo(() => (typeof window === "undefined" ? null : loadRewriteState()), []);

  const [rewrite, setRewrite] = useState(saved?.rewrite ?? "");
  const [result, setResult] = useState(saved?.result ?? original);
  const [dismissed, setDismissed] = useState<string[]>(saved?.dismissed ?? []);
  // Mirror of result/rewrite for event handlers (Download captures the latest
  // even if a blur-commit's setState hasn't flushed yet).
  const resultRef = useRef(result);
  const rewriteRef = useRef(rewrite);
  // Bumped to remount the (uncontrolled) editor on structural changes.
  const [editorKey, setEditorKey] = useState(0);

  const [gen, setGen] = useState<Status>({ kind: "idle" });
  const [exporting, setExporting] = useState<Status>({ kind: "idle" });
  const restored = saved !== null && (saved.rewrite.trim().length > 0 || saved.result !== original);

  const hasRewrite = rewrite.trim().length > 0;

  // Stable callback the editor calls on commit (accept / dismiss / blur).
  const persist = useCallback((nextResult: string, nextDismissed: string[]) => {
    resultRef.current = nextResult;
    setResult(nextResult);
    setDismissed(nextDismissed);
    saveRewriteState({ rewrite: rewriteRef.current, result: nextResult, dismissed: nextDismissed });
  }, []);

  const generate = async () => {
    setGen({ kind: "loading" });
    try {
      const res = await fetch("/api/rewrite-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: resultRef.current || original,
          jobText,
          jobTitle,
          company,
          context: combinedContextText(materials),
          missingSkills,
          aiTells: (aiDetection?.patterns ?? [])
            .filter((p) => p.signal >= 25)
            .map((p) => ({ label: p.label, examples: p.examples.slice(0, 6) })),
        }),
      });
      const data: { resume?: string; error?: string } = await res.json();
      if (!res.ok || !data.resume) throw new Error(data.error ?? `Request failed (${res.status}).`);
      rewriteRef.current = data.resume;
      setRewrite(data.resume);
      setDismissed([]);
      saveRewriteState({ rewrite: data.resume, result: resultRef.current, dismissed: [] });
      setEditorKey((k) => k + 1);
      setGen({ kind: "idle" });
    } catch (err: unknown) {
      setGen({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  const acceptAll = () => {
    persist(rewriteRef.current, []);
    setEditorKey((k) => k + 1);
  };

  const reset = () => {
    persist(original, []);
    setEditorKey((k) => k + 1);
  };

  // Re-parse the working result into structured fields, then export a PDF.
  const downloadPdf = async () => {
    setExporting({ kind: "loading" });
    const text = resultRef.current.trim() || original;
    let data: ResumeData;
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text }),
      });
      const d: { resume?: unknown } = await res.json();
      data = res.ok && isResumeData(d.resume) ? d.resume : parseResume(text);
    } catch {
      data = parseResume(text);
    }
    try {
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore unavailable storage
    }
    try {
      await downloadResumePdf(data, company);
      setExporting({ kind: "idle" });
    } catch (err: unknown) {
      setExporting({ kind: "error", message: err instanceof Error ? err.message : "Failed to build the PDF." });
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Resume</h2>
          <p className="mt-1 text-sm text-slate-500">
            Generate a tailored rewrite, then click any suggestion to accept it into your resume, or
            just type to edit. Export a clean PDF when you&apos;re done. Saved on this device and
            restored next time.
          </p>
          {restored && <p className="mt-1 text-xs text-emerald-600">Restored your saved draft.</p>}
        </div>
        <button
          onClick={downloadPdf}
          disabled={exporting.kind === "loading"}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {exporting.kind === "loading" ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      {exporting.kind === "error" && (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {exporting.message}
        </p>
      )}

      {/* Control: context materials + generate */}
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">Tailor to this posting</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Rewrites your resume to match the job, grounded in your real experience — never fabricated.
          It also fixes the AI-authorship tells flagged in the report. Add context materials to ground
          it in more of your work.
        </p>
        <ContextMaterialsPanel materials={materials} onChange={onMaterialsChange} />
        <button
          onClick={generate}
          disabled={gen.kind === "loading"}
          className="mt-3 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {gen.kind === "loading" ? "Rewriting…" : hasRewrite ? "Regenerate rewrite" : "Generate tailored rewrite"}
        </button>
        {gen.kind === "error" && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {gen.message}
          </p>
        )}
      </section>

      {hasRewrite && (
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">
            Click a <span className="rounded bg-emerald-100 px-1 text-emerald-900">green suggestion</span> to accept it,
            or × to dismiss. Type anywhere to edit.
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={acceptAll} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
              Accept all
            </button>
            <button onClick={reset} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
              Reset to original
            </button>
          </div>
        </div>
      )}

      {gen.kind === "loading" ? (
        <div className="space-y-2" aria-hidden>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${95 - (i % 4) * 12}%` }} />
          ))}
        </div>
      ) : (
        <RewriteEditor
          key={editorKey}
          rewrite={rewrite}
          initialResult={result}
          initialDismissed={dismissed}
          onChange={persist}
        />
      )}
    </div>
  );
}

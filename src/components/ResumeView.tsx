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
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";

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
      let data: { resume?: string; error?: string };
      try { data = await res.json(); } catch { throw new Error(`Server error (${res.status}). Try again.`); }
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
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Resume</h2>
          <p className="mt-1 text-sm text-slate-500">
            Generate a tailored rewrite, then click any suggestion to accept it into your resume, or
            just type to edit. Export a clean PDF when you&apos;re done. Saved on this device and
            restored next time.
          </p>
          {restored && <p className="mt-1 text-xs text-emerald-600">Restored your saved draft.</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            label={gen.kind === "loading" ? "Rewriting…" : hasRewrite ? "Regenerate" : "Generate rewrite"}
            variant="primary"
            size="sm"
            onClick={generate}
            isDisabled={gen.kind === "loading"}
          />
          <Button
            label={exporting.kind === "loading" ? "Preparing…" : "Download PDF"}
            variant="primary"
            size="sm"
            onClick={downloadPdf}
            isDisabled={exporting.kind === "loading"}
          />
          <Button
            label="Save as Resume"
            variant="secondary"
            size="sm"
            onClick={async () => {
              const text = resultRef.current.trim() || original;
              const name = `${company ? company.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_").toLowerCase() : "tailored"}_resume_${new Date().getFullYear()}`;
              const res = await fetch("/api/resumes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, content: text, tags: [company].filter(Boolean) }),
              });
              if (res.ok) {
                alert("Saved as new resume in your Profile.");
              }
            }}
          />
        </div>
      </div>

      {exporting.kind === "error" && (
        <Banner status="error" title={exporting.message ?? "An error occurred."} className="mb-4" />
      )}

      {/* Control: context materials + generate */}
      <Card className="mb-4 p-5">
        <h3 className="text-sm font-semibold text-slate-700">Tailor to this posting</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Rewrites your resume to match the job, grounded in your real experience — never fabricated.
          It also fixes the AI-authorship tells flagged in the report. Add context materials to ground
          it in more of your work.
        </p>
        <ContextMaterialsPanel materials={materials} onChange={onMaterialsChange} />
        {gen.kind === "error" && (
          <Banner status="error" title={gen.message ?? "Something went wrong."} className="mt-3" />
        )}
      </Card>

      {hasRewrite && (
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">
            Click a <span className="rounded bg-emerald-100 px-1 text-emerald-900">green suggestion</span> to accept it,
            or × to dismiss. Type anywhere to edit.
          </span>
          <div className="ml-auto flex gap-2">
            <Button label="Accept all" variant="secondary" size="sm" onClick={acceptAll} />
            <Button label="Reset to original" variant="secondary" size="sm" onClick={reset} />
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

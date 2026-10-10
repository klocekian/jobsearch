"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { parseResume } from "@/lib/resume/parse";
import type { ResumeData } from "@/lib/resume/types";
import { downloadResumePdf } from "@/lib/pdf/resume";
import { isResumeData, loadRewriteState, saveResume, saveRewriteState } from "@/lib/storage";
import { ContextMaterialsPanel } from "./ContextMaterialsPanel";
import { RewriteEditor } from "./RewriteEditor";
import { combinedContextText, type ContextMaterial } from "@/lib/context";
import { apiFetch, apiSend, errorMessage, readTextStream } from "@/lib/api-client";
import type { AiDetection } from "@/lib/analysis/types";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";

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
  onBack?: () => void;
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
  onBack,
}: ResumeViewProps) {
  const original = resumeText;
  const saved = useMemo(() => (typeof window === "undefined" ? null : loadRewriteState()), []);

  const [rewrite, setRewrite] = useState(saved?.rewrite ?? "");
  const [result, setResult] = useState(saved?.result ?? original);
  const [saveNote, setSaveNote] = useState<{ ok: boolean; text: string } | null>(null);
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
    setRewrite("");
    try {
      const res = await apiFetch("/api/rewrite-resume", {
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
      const accumulated = await readTextStream(res, setRewrite);

      rewriteRef.current = accumulated;
      setDismissed([]);
      saveRewriteState({ rewrite: accumulated, result: resultRef.current, dismissed: [] });
      setEditorKey((k) => k + 1);
      setGen({ kind: "idle" });
    } catch (err: unknown) {
      setGen({ kind: "error", message: errorMessage(err, "Something went wrong.") });
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
      const d = await apiSend<{ resume?: unknown }>("/api/parse-resume", "POST", { resumeText: text });
      data = isResumeData(d.resume) ? d.resume : parseResume(text);
    } catch {
      data = parseResume(text);
    }
    saveResume(data);
    try {
      await downloadResumePdf(data, company);
      setExporting({ kind: "idle" });
    } catch (err: unknown) {
      setExporting({ kind: "error", message: err instanceof Error ? err.message : "Failed to build the PDF." });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack && <Button label="← Back" variant="ghost" size="sm" onClick={onBack} />}
          {restored && <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Restored saved draft</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            label={gen.kind === "loading" ? "Rewriting…" : hasRewrite ? "Regenerate rewrite" : "Generate rewrite"}
            variant="primary"
            size="sm"
            onClick={generate}
            isDisabled={gen.kind === "loading"}
          />
          <Button
            label={exporting.kind === "loading" ? "Preparing…" : "Download PDF"}
            variant="secondary"
            size="sm"
            onClick={downloadPdf}
            isDisabled={exporting.kind === "loading"}
          />
          <Button
            label="Save as Resume"
            variant="ghost"
            size="sm"
            onClick={async () => {
              const text = resultRef.current.trim() || original;
              const name = `${company ? company.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_").toLowerCase() : "tailored"}_resume_${new Date().getFullYear()}`;
              try {
                await apiSend("/api/resumes", "POST", { name, content: text, tags: [company].filter(Boolean) });
                setSaveNote({ ok: true, text: "Saved as a new resume in your Profile." });
              } catch (err) {
                setSaveNote({ ok: false, text: errorMessage(err, "Could not save the resume.") });
              }
            }}
          />
        </div>
      </div>

      {saveNote && (
        <Banner status={saveNote.ok ? "success" : "error"} title={saveNote.text} className="text-xs" />
      )}
      {exporting.kind === "error" && (
        <Banner status="error" title={exporting.message ?? "An error occurred."} className="text-xs" />
      )}
      {gen.kind === "error" && (
        <Banner status="error" title={gen.message ?? "Something went wrong."} className="text-xs" />
      )}

      {/* Single-row Context materials uploader */}
      <ContextMaterialsPanel materials={materials} onChange={onMaterialsChange} />

      {hasRewrite && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Click a <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1 text-emerald-900 dark:text-emerald-200">green suggestion</span> to accept, or × to dismiss. Type anywhere to edit.
          </span>
          <div className="ml-auto flex gap-1.5">
            <Button label="Accept all" variant="secondary" size="sm" onClick={acceptAll} />
            <Button label="Reset to original" variant="ghost" size="sm" onClick={reset} />
          </div>
        </div>
      )}

      {gen.kind === "loading" ? (
        <div className="space-y-3">
          {rewrite ? (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 font-mono text-xs whitespace-pre-wrap text-primary animate-pulse">
              {rewrite}
            </div>
          ) : (
            <div className="space-y-2" aria-hidden>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${95 - (i % 4) * 12}%` }} />
              ))}
            </div>
          )}
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

"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { parseResume } from "@/lib/resume/parse";
import { resumeToMarkdown } from "@/lib/resume/markdown";
import type { ResumeData } from "@/lib/resume/types";
import type { ResumeRow } from "@/lib/db/resumes";
import { downloadResumePdf } from "@/lib/pdf/resume";
import { documentFileBase } from "@/lib/pdf/shared";
import { downloadText } from "@/lib/download";
import { isResumeData, loadRewriteState, saveRewriteState } from "@/lib/storage";
import { ContextMaterialsPanel } from "./ContextMaterialsPanel";
import { RewriteEditor } from "./RewriteEditor";
import { DownloadMenu } from "./DownloadMenu";
import { DOC_SURFACE, DocumentField } from "./DocumentField";
import { combinedContextText, type ContextMaterial } from "@/lib/context";
import { apiFetch, apiSend, errorMessage, readTextStream } from "@/lib/api-client";
import type { AiDetection } from "@/lib/analysis/types";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";

interface ResumeViewProps {
  jobId: number;
  /** The picked resume's text — the starting point ("original"). */
  resumeText: string;
  /** The saved resume `resumeText` came from, which Save overwrites. */
  resume: ResumeRow | null;
  company: string;
  jobText: string;
  jobTitle: string;
  /** Skills the job wants that the analyzer didn't find — fed to the rewrite. */
  missingSkills: string[];
  /** AI-authorship tells detected, so the rewrite can target and remove them. */
  aiDetection: AiDetection | null;
  materials: ContextMaterial[];
  onMaterialsChange: (materials: ContextMaterial[]) => void;
  /** A resume was written: `resume` saved over, or a new one created. */
  onSaved: (resume: ResumeRow, isNew: boolean) => void;
  /** The resume picker, shown at the start of the toolbar. */
  picker?: ReactNode;
}

type Status = { kind: "idle" | "loading" | "error"; message?: string };

export function ResumeView({
  jobId,
  resumeText,
  resume,
  company,
  jobText,
  jobTitle,
  missingSkills,
  aiDetection,
  materials,
  onMaterialsChange,
  onSaved,
  picker,
}: ResumeViewProps) {
  const original = resumeText;
  // A draft built on a different resume doesn't apply to this one.
  const saved = useMemo(() => {
    if (typeof window === "undefined") return null;
    const s = loadRewriteState(jobId);
    return s && s.base === original ? s : null;
  }, [jobId, original]);

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
  const [saving, setSaving] = useState<Status>({ kind: "idle" });
  // Read until Edit (or Generate). Changes still persist as they're made, so a
  // tab switch loses nothing; Cancel puts back what was there at Edit.
  const [editing, setEditing] = useState(false);
  const snapshot = useRef<{ result: string; rewrite: string; dismissed: string[] } | null>(null);

  const hasRewrite = rewrite.trim().length > 0;
  const tailored = result !== original;

  // Stable callback the editor calls on commit (accept / dismiss / blur).
  const persist = useCallback((nextResult: string, nextDismissed: string[]) => {
    resultRef.current = nextResult;
    setResult(nextResult);
    setDismissed(nextDismissed);
    saveRewriteState(jobId, { base: original, rewrite: rewriteRef.current, result: nextResult, dismissed: nextDismissed });
  }, [jobId, original]);

  const startEdit = () => {
    snapshot.current = { result: resultRef.current, rewrite: rewriteRef.current, dismissed };
    setEditing(true);
  };

  const cancelEdit = () => {
    const s = snapshot.current;
    if (s) {
      rewriteRef.current = s.rewrite;
      setRewrite(s.rewrite);
      persist(s.result, s.dismissed);
      setEditorKey((k) => k + 1);
    }
    setEditing(false);
  };

  const generate = async () => {
    if (!editing) startEdit();
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
      saveRewriteState(jobId, { base: original, rewrite: accumulated, result: resultRef.current, dismissed: [] });
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

  // Re-parse the working result into structured fields for the exports.
  const structured = async (): Promise<ResumeData> => {
    const text = resultRef.current.trim() || original;
    try {
      const d = await apiSend<{ resume?: unknown }>("/api/parse-resume", "POST", { resumeText: text });
      return isResumeData(d.resume) ? d.resume : parseResume(text);
    } catch {
      return parseResume(text);
    }
  };

  const download = async (format: "pdf" | "md") => {
    setExporting({ kind: "loading" });
    try {
      const data = await structured();
      if (format === "pdf") await downloadResumePdf(data, company);
      else downloadText(`${documentFileBase("Resume", data.name, company)}.md`, resumeToMarkdown(data));
      setExporting({ kind: "idle" });
    } catch (err: unknown) {
      setExporting({ kind: "error", message: err instanceof Error ? err.message : "Failed to build the file." });
    }
  };

  const save = async (asNew: boolean) => {
    const text = resultRef.current.trim() || original;
    if (!asNew && resume && !confirm(`Save over "${resume.name}"? Other jobs using it will see the change.`)) return;
    setSaving({ kind: "loading" });
    try {
      let row: ResumeRow;
      if (asNew || !resume) {
        const name = `${company ? company.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_").toLowerCase() : "tailored"}_resume_${new Date().getFullYear()}`;
        row = (await apiSend<{ resume: ResumeRow }>("/api/resumes", "POST", { name, content: text, tags: [company].filter(Boolean) })).resume;
      } else {
        row = (await apiSend<{ resume: ResumeRow }>(`/api/resumes/${resume.id}`, "PATCH", { content: text })).resume;
      }
      // The saved text is the new starting point; keep the AI suggestions.
      saveRewriteState(jobId, { base: row.content, rewrite: rewriteRef.current, result: row.content, dismissed });
      setSaving({ kind: "idle" });
      setEditing(false);
      onSaved(row, asNew || !resume);
    } catch (err) {
      setSaving({ kind: "error", message: errorMessage(err, "Could not save the resume.") });
    }
  };

  const busy = exporting.kind === "loading" || saving.kind === "loading";

  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {editing ? (
          <span className="text-sm font-semibold text-primary">{resume?.name ?? "Resume"}</span>
        ) : (
          <>
            {picker}
            <Button label="Edit" variant="secondary" size="sm" onClick={startEdit} />
            {tailored && <span className="text-sm text-emerald-700 dark:text-emerald-400">Tailored for this job</span>}
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            label={gen.kind === "loading" ? "Generating…" : hasRewrite ? "Regenerate" : "Generate"}
            variant="secondary"
            size="sm"
            onClick={generate}
            isDisabled={gen.kind === "loading" || !jobText.trim()}
          />
          {editing ? (
            <>
              <Button label="Cancel" variant="secondary" size="sm" onClick={cancelEdit} isDisabled={busy || gen.kind === "loading"} />
              <DropdownMenu
                button={{ label: saving.kind === "loading" ? "Saving…" : "Save", variant: "primary", size: "sm", isDisabled: busy || gen.kind === "loading" }}
                hasChevron
                items={[
                  { label: "Save for this job", onClick: () => setEditing(false) },
                  ...(resume ? [{ label: `Save to "${resume.name}"`, onClick: () => save(false) }] : []),
                  { label: "Save as new resume", onClick: () => save(true) },
                ]}
              />
            </>
          ) : (
            <DownloadMenu
              onPdf={() => download("pdf")}
              onMarkdown={() => download("md")}
              busy={exporting.kind === "loading"}
            />
          )}
        </div>
      </div>

      {exporting.kind === "error" && (
        <Banner status="error" title={exporting.message ?? "An error occurred."} className="text-sm" />
      )}
      {saving.kind === "error" && (
        <Banner status="error" title={saving.message ?? "Could not save the resume."} className="text-sm" />
      )}
      {gen.kind === "error" && (
        <Banner status="error" title={gen.message ?? "Something went wrong."} className="text-sm" />
      )}

      {/* Single-row Context materials uploader */}
      <ContextMaterialsPanel materials={materials} onChange={onMaterialsChange} />

      {editing && hasRewrite && gen.kind !== "loading" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
            <div className={`${DOC_SURFACE} whitespace-pre-wrap animate-pulse`}>
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
      ) : editing ? (
        <RewriteEditor
          key={editorKey}
          rewrite={rewrite}
          initialResult={result}
          initialDismissed={dismissed}
          onChange={persist}
        />
      ) : (
        <DocumentField label="Resume" value={result} />
      )}
    </div>
  );
}

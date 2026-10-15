"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseResume } from "@/lib/resume/parse";
import { resumeToMarkdown } from "@/lib/resume/markdown";
import type { ResumeData } from "@/lib/resume/types";
import type { ResumeRow } from "@/lib/db/resumes";
import { buildResumeDoc } from "@/lib/pdf/resume";
import { documentFileBase } from "@/lib/pdf/shared";
import { checkParseFidelity } from "@/lib/analysis/parse-fidelity";
import { readyToApply } from "@/lib/analysis/ready-to-apply";
import { bandForScore } from "@/lib/fitness/schema";
import { downloadText } from "@/lib/download";
import { isResumeData, loadResumePdfTemplate, loadRewriteState, saveResumePdfTemplate, saveRewriteState, type ResumePdfTemplate } from "@/lib/storage";
import { ContextMaterialsPanel } from "./ContextMaterialsPanel";
import { RewriteEditor } from "./RewriteEditor";
import { DownloadMenu } from "./DownloadMenu";
import { DOC_SURFACE, DocumentField } from "./DocumentField";
import { combinedContextText, type ContextMaterial } from "@/lib/context";
import { apiFetch, apiSend, errorMessage, readTextStream } from "@/lib/api-client";
import type { AiDetection, CheckItem } from "@/lib/analysis/types";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useConfirm } from "@/hooks/useConfirm";

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
  fitnessScore?: number | null;
  matchScore?: number | null;
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
  fitnessScore,
  matchScore,
  materials,
  onMaterialsChange,
  onSaved,
  picker,
}: ResumeViewProps) {
  const original = resumeText;
  const { confirm, dialog: confirmDialog } = useConfirm();
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
  const [pdfChecks, setPdfChecks] = useState<CheckItem[] | null>(null);
  const pendingPdf = useRef<{ doc: Awaited<ReturnType<typeof buildResumeDoc>>; filename: string } | null>(null);
  const [confirmPdf, setConfirmPdf] = useState(false);
  const ready = readyToApply(pdfChecks, { fitness: fitnessScore, match: matchScore, aiBand: aiDetection?.band });
  const fitnessBand = ready.fitness === null ? null : bandForScore(ready.fitness);
  const pdfVariant: BadgeVariant = ready.parseStatus === "pass" ? "success" : ready.parseStatus === "warning" ? "warning" : ready.parseStatus === "fail" ? "error" : "neutral";
  const fitnessVariant: BadgeVariant = fitnessBand === null ? "neutral" : fitnessBand === "target" || fitnessBand === "priority target" ? "success" : fitnessBand === "practice" ? "warning" : "error";
  const matchVariant: BadgeVariant = ready.match === null ? "neutral" : ready.match >= 90 ? "success" : ready.match >= 80 ? "warning" : "error";
  const aiVariant: BadgeVariant = ready.aiBand === "low" ? "success" : ready.aiBand === "moderate" ? "warning" : ready.aiBand === "high" ? "error" : "neutral";
  const clearPdfCheck = () => {
    setPdfChecks(null);
    pendingPdf.current = null;
    setConfirmPdf(false);
  };
  const [pdfTemplate, setPdfTemplate] = useState<ResumePdfTemplate>("classic");
  useEffect(() => {
    const stored = loadResumePdfTemplate();
    queueMicrotask(() => setPdfTemplate(stored));
  }, []);
  const changePdfTemplate = (template: ResumePdfTemplate) => {
    clearPdfCheck();
    setPdfTemplate(template);
    saveResumePdfTemplate(template);
  };
  const [saving, setSaving] = useState<Status>({ kind: "idle" });
  // Read until Edit (or Generate). Changes still persist as they're made, so a
  // tab switch loses nothing; Cancel puts back what was there at Edit.
  const [editing, setEditing] = useState(false);
  const snapshot = useRef<{ result: string; rewrite: string; dismissed: string[] } | null>(null);

  const hasRewrite = rewrite.trim().length > 0;
  const tailored = result !== original;

  // Stable callback the editor calls on commit (accept / dismiss / blur).
  const persist = useCallback((nextResult: string, nextDismissed: string[]) => {
    setPdfChecks(null);
    pendingPdf.current = null;
    setConfirmPdf(false);
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
      if (format === "pdf") {
        clearPdfCheck();
        const doc = await buildResumeDoc(data, { template: pdfTemplate });
        // pdf.js remains outside the initial browser bundle.
        const { extractPdfTextFromBuffer } = await import("@/lib/pdf");
        const { rawText } = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
        const checks = checkParseFidelity(rawText);
        setPdfChecks(checks);
        const filename = `${documentFileBase("Resume", data.name, company)}.pdf`;
        if (readyToApply(checks).needsConfirmation) {
          pendingPdf.current = { doc, filename };
          setConfirmPdf(true);
        } else {
          doc.save(filename);
        }
      } else {
        downloadText(`${documentFileBase("Resume", data.name, company)}.md`, resumeToMarkdown(data));
      }
      setExporting({ kind: "idle" });
    } catch (err: unknown) {
      setExporting({ kind: "error", message: err instanceof Error ? err.message : "Failed to build the file." });
    }
  };

  const save = async (asNew: boolean) => {
    const text = resultRef.current.trim() || original;
    if (!asNew && resume && !(await confirm({ title: `Save over "${resume.name}"?`, description: "Other jobs using this resume will see the change.", actionLabel: "Save over it" }))) return;
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
      {confirmDialog}
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
              template={pdfTemplate}
              onTemplateChange={changePdfTemplate}
              busy={exporting.kind === "loading"}
            />
          )}
        </div>
      </div>

      {exporting.kind === "error" && (
        <Banner status="error" title={exporting.message ?? "An error occurred."} className="text-sm" />
      )}
      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm" aria-label="Ready to apply status">
        <h3 className="mb-2 font-semibold text-foreground">Ready to apply</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pdfVariant} className="!h-auto !min-h-7 !py-1 !text-sm" label={`PDF check: ${ready.parseStatus === "unchecked" ? "not checked" : ready.parseStatus === "pass" ? "passed" : ready.parseStatus === "fail" ? `${ready.failures} issue${ready.failures === 1 ? "" : "s"}` : `${ready.warnings} warning${ready.warnings === 1 ? "" : "s"}`}`} />
          <Badge variant={fitnessVariant} className="!h-auto !min-h-7 !py-1 !text-sm" label={`Fitness (last analysis): ${ready.fitness === null ? "not checked" : `${ready.fitness}/100`}`} />
          <Badge variant={matchVariant} className="!h-auto !min-h-7 !py-1 !text-sm" label={`Match (last analysis): ${ready.match === null ? "not checked" : `${ready.match}/100`}`} />
          <Badge variant={aiVariant} className="!h-auto !min-h-7 !py-1 !text-sm" label={`AI signal (last analysis): ${ready.aiBand ?? "not checked"}`} />
        </div>
        {pdfChecks?.some((item) => item.status === "warning") && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
            {pdfChecks.filter((item) => item.status === "warning").map((item) => <li key={item.message}>{item.message}</li>)}
          </ul>
        )}
      </div>
      {confirmPdf && (
        <Banner
          status="warning"
          title="The PDF text check found a problem."
          description={pdfChecks?.filter((item) => item.status === "fail").map((item) => item.message).join(" ")}
          endContent={
            <div className="flex gap-2">
              <Button label="Download anyway" variant="primary" size="sm" onClick={() => {
                try {
                  pendingPdf.current?.doc.save(pendingPdf.current.filename);
                  pendingPdf.current = null;
                  setConfirmPdf(false);
                } catch (err: unknown) {
                  setExporting({ kind: "error", message: err instanceof Error ? err.message : "Failed to save the file." });
                }
              }} />
              <Button label="Cancel" variant="secondary" size="sm" onClick={() => {
                pendingPdf.current = null;
                setConfirmPdf(false);
              }} />
            </div>
          }
        />
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

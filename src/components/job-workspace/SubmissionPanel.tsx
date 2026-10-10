"use client";

import { useRef, useState } from "react";
import type { SubmissionRow, SUBMISSION_FORMATS } from "@/lib/db/submissions";
import type { ResumeRow } from "@/lib/db/resumes";
import { coverLetterText, tailoredResumeText } from "@/lib/storage";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Banner } from "@astryxdesign/core/Banner";
import { Selector } from "@astryxdesign/core/Selector";
import { DocumentField } from "../DocumentField";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Stack, HStack } from "@astryxdesign/core/Stack";
import type { SubmissionDocType } from "./applicationDocs";

type SubmissionFormat = (typeof SUBMISSION_FORMATS)[number];

const MAX_PDF_BYTES = 3 * 1024 * 1024;

export interface SubmissionEdit {
  type: SubmissionDocType;
  /** The submission being changed; null adds one. */
  existing: SubmissionRow | null;
  label: string;
  format: SubmissionFormat;
  /** Text, or base64 for a PDF. Undefined keeps the existing content. */
  content?: string;
}

interface SubmissionPanelProps {
  jobId: number;
  submissions: SubmissionRow[];
  resumes: ResumeRow[];
  /** Resolves true once saved, so the editor can close. */
  onSave: (edit: SubmissionEdit) => Promise<boolean>;
  onRemove: (submissionId: number) => void;
}

interface Choice {
  value: string;
  label: string;
  /** The submission label when this choice is saved. */
  saveAs: string;
  text: string;
}

function stamp(ts: string): string {
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleDateString();
}

function asFormat(format: string): SubmissionFormat {
  return format === "md" || format === "pdf" ? format : "txt";
}

/** A File's contents as base64 (no data: prefix). */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * What was sent for this job: the resume and cover letter saved when it was
 * marked Applied (newest of each), then everything older.
 */
export function SubmissionPanel({ jobId, submissions, resumes, onSave, onRemove }: SubmissionPanelProps) {
  // Submissions arrive newest first.
  const resume = submissions.find((s) => s.type === "resume") ?? null;
  const letter = submissions.find((s) => s.type === "cover_letter") ?? null;
  const earlier = submissions.filter((s) => s !== resume && s !== letter);

  const resumeChoices = (): Choice[] => {
    const tailored = tailoredResumeText(jobId);
    return [
      ...(tailored ? [{ value: "tailored", label: "Tailored resume (Tools)", saveAs: "Tailored resume", text: tailored }] : []),
      ...resumes.map((r) => ({ value: `resume:${r.id}`, label: r.name, saveAs: `Resume — ${r.name}`, text: r.content })),
    ];
  };
  const letterChoices = (): Choice[] => {
    const draft = coverLetterText(jobId);
    return draft.trim() ? [{ value: "draft", label: "Cover letter draft (Tools)", saveAs: "Cover letter", text: draft }] : [];
  };

  return (
    <Stack gap={3}>
      {!resume && !letter && (
        <Banner
          status="info"
          title="Nothing submitted yet."
          description="Marking this job Applied saves the resume and cover letter you're using here. You can also add them by hand, as text or a PDF."
        />
      )}

      <div className="divide-y divide-border">
        <SubmittedDoc
          jobId={jobId}
          title="Resume"
          type="resume"
          submission={resume}
          choices={resumeChoices}
          onSave={onSave}
        />
        <SubmittedDoc
          jobId={jobId}
          title="Cover letter"
          type="cover_letter"
          submission={letter}
          choices={letterChoices}
          onSave={onSave}
        />
      </div>

      {earlier.length > 0 && <EarlierSubmissions jobId={jobId} submissions={earlier} onRemove={onRemove} />}
    </Stack>
  );
}

/** A submission as it was sent: the PDF itself, rendered Markdown, or plain text. */
function SubmissionBody({ jobId, submission }: { jobId: number; submission: SubmissionRow }) {
  if (submission.format === "pdf") {
    return (
      <iframe
        title={submission.label}
        src={`/api/jobs/${jobId}/submissions/${submission.id}?inline=1`}
        className="h-[70vh] w-full rounded-md ring-1 ring-border"
      />
    );
  }
  return (
    <DocumentField
      label={submission.label}
      value={submission.content}
      format={submission.format === "md" ? "markdown" : "text"}
    />
  );
}

interface SubmittedDocProps {
  jobId: number;
  title: string;
  type: SubmissionDocType;
  submission: SubmissionRow | null;
  /** Read when the editor opens, so drafts made in Tools are current. */
  choices: () => Choice[];
  onSave: (edit: SubmissionEdit) => Promise<boolean>;
}

interface EditState {
  format: SubmissionFormat;
  options: Choice[];
  picked: string;
  label: string;
  text: string;
  /** A newly chosen PDF; null keeps the current one (if it is a PDF). */
  pdf: { name: string; base64: string } | null;
}

/** One submitted document, read-only until Edit. Text, Markdown or a PDF — the user's choice. */
function SubmittedDoc({ jobId, title, type, submission, choices, onSave }: SubmittedDocProps) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasPdf = submission?.format === "pdf";

  const open = () => {
    setFileError(null);
    setEditing({
      format: asFormat(submission?.format ?? "txt"),
      options: choices(),
      picked: "",
      label: submission?.label ?? title,
      text: hasPdf ? "" : (submission?.content ?? ""),
      pdf: null,
    });
  };

  const pickPdf = async (file: File) => {
    if (!editing) return;
    setFileError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setFileError("PDFs can be up to 3 MB.");
      return;
    }
    const base64 = await readBase64(file);
    setEditing({ ...editing, pdf: { name: file.name, base64 }, label: `${title} — ${file.name.replace(/\.pdf$/i, "")}` });
  };

  const canSave = !!editing && (editing.format === "pdf" ? !!editing.pdf || hasPdf : !!editing.text.trim());

  const save = async () => {
    if (!editing || !canSave) return;
    setSaving(true);
    const content = editing.format === "pdf" ? editing.pdf?.base64 : editing.text;
    const ok = await onSave({ type, existing: submission, label: editing.label, format: editing.format, content });
    setSaving(false);
    if (ok) setEditing(null);
  };

  return (
    <div className="py-3 first:pt-0">
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0">
          <Text weight="semibold" display="block">{title}</Text>
          {submission && (
            <Text type="supporting" display="block">{submission.label} · {stamp(submission.created_at)}</Text>
          )}
        </div>
        {editing ? (
          <div className="ml-auto flex shrink-0 gap-2">
            <Button label="Cancel" variant="secondary" size="sm" onClick={() => setEditing(null)} isDisabled={saving} />
            <Button label={saving ? "Saving…" : "Save"} variant="primary" size="sm" onClick={save} isDisabled={saving || !canSave} />
          </div>
        ) : (
          <Button label={submission ? "Edit" : "Add"} variant="secondary" size="sm" onClick={open} />
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <SegmentedControl
            value={editing.format}
            onChange={(v) => setEditing({ ...editing, format: v as SubmissionFormat })}
            label="Format"
          >
            <SegmentedControlItem value="txt" label="Text" />
            <SegmentedControlItem value="md" label="Markdown" />
            <SegmentedControlItem value="pdf" label="PDF" />
          </SegmentedControl>

          {editing.format === "pdf" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  label={editing.pdf || hasPdf ? "Choose another PDF…" : "Choose PDF…"}
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                />
                <Text type="supporting" color="secondary">
                  {editing.pdf ? editing.pdf.name : hasPdf ? "Keeping the current PDF." : "Up to 3 MB."}
                </Text>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) pickPdf(file).catch(() => setFileError("Couldn't read that file."));
                  }}
                />
              </div>
              {fileError && <Banner status="error" title={fileError} />}
            </div>
          ) : (
            <>
              {editing.options.length > 0 && (
                <Selector
                  label="Replace with"
                  options={[{ value: "", label: "Keep current text" }, ...editing.options.map((o) => ({ value: o.value, label: o.label }))]}
                  value={editing.picked}
                  onChange={(v) => {
                    const choice = editing.options.find((o) => o.value === v);
                    setEditing({
                      ...editing,
                      picked: v,
                      label: choice ? choice.saveAs : (submission?.label ?? title),
                      text: choice ? choice.text : hasPdf ? "" : (submission?.content ?? ""),
                    });
                  }}
                />
              )}
              <DocumentField
                label={`${title} text`}
                value=""
                editing
                draft={editing.text}
                onDraftChange={(text) => setEditing({ ...editing, text })}
              />
            </>
          )}
        </div>
      ) : submission ? (
        <SubmissionBody jobId={jobId} submission={submission} />
      ) : (
        <Text type="supporting" color="secondary">
          {type === "resume" ? "No resume saved." : "No cover letter saved."}
        </Text>
      )}
    </div>
  );
}

interface EarlierSubmissionsProps {
  jobId: number;
  submissions: SubmissionRow[];
  onRemove: (submissionId: number) => void;
}

/** Older snapshots, earlier application packages, and uploaded files. */
function EarlierSubmissions({ jobId, submissions, onRemove }: EarlierSubmissionsProps) {
  const [viewingId, setViewingId] = useState<number | null>(null);

  return (
    <div className="border-t border-border pt-3">
      <Text type="label" weight="semibold" display="block" className="text-xs uppercase tracking-wider text-muted-foreground">Earlier</Text>
      <div className="divide-y divide-border">
        {submissions.map((s) => {
          const viewable = s.format === "pdf" || !!s.content;
          return (
            <div key={s.id} className="py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <Text weight="semibold" display="block">{s.label}</Text>
                  <Text type="supporting" display="block">{s.type.replace("_", " ")} · {s.format.toUpperCase()} · {stamp(s.created_at)}</Text>
                </div>
                <HStack gap={2}>
                  {viewable && (
                    <Button
                      label={viewingId === s.id ? "Close" : "View"}
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingId(viewingId === s.id ? null : s.id)}
                    />
                  )}
                  <Button label="Download" variant="ghost" size="sm" href={`/api/jobs/${jobId}/submissions/${s.id}?download=1`} />
                  <Button label="Remove" variant="ghost" size="sm" onClick={() => onRemove(s.id)} />
                </HStack>
              </div>
              {viewingId === s.id && viewable && (
                <div className="mt-2">
                  <SubmissionBody jobId={jobId} submission={s} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

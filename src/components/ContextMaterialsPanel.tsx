"use client";

import { useRef, useState } from "react";
import { extractFileText, isSupportedFile, SUPPORTED_FORMATS } from "@/lib/extract";
import {
  CONTEXT_CHAR_CAP,
  totalContextChars,
  type ContextMaterial,
} from "@/lib/context";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";

interface ContextMaterialsPanelProps {
  materials: ContextMaterial[];
  onChange: (materials: ContextMaterial[]) => void;
}

type Status = { kind: "idle" | "loading" | "error"; message?: string };

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.floor(performance.now() * 1000)}`;
}

function sourceFor(file: File): ContextMaterial["source"] {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "pdf";
  if (/\.docx$/i.test(file.name)) return "docx";
  return "text";
}

/**
 * Reusable uploader for supplementary context materials. Controlled — the parent
 * owns the list (lifted into App) so the same materials appear in every tab that
 * renders this panel. Accepts PDF, DOCX, .txt/.md (extracted in-browser), and
 * pasted snippets.
 */
export function ContextMaterialsPanel({ materials, onChange }: ContextMaterialsPanelProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const add = (material: ContextMaterial) => {
    if (totalContextChars(materials) + material.text.length > CONTEXT_CHAR_CAP) {
      setStatus({
        kind: "error",
        message: "That would exceed the context size limit. Remove a material first.",
      });
      return;
    }
    onChange([...materials, material]);
  };

  const remove = (id: string) => onChange(materials.filter((m) => m.id !== id));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setStatus({ kind: "loading" });
    for (const file of Array.from(files)) {
      if (!isSupportedFile(file)) {
        setStatus({ kind: "error", message: `${file.name}: unsupported type. Use ${SUPPORTED_FORMATS}.` });
        continue;
      }
      try {
        const { text } = await extractFileText(file);
        if (!text.trim()) {
          setStatus({ kind: "error", message: `${file.name}: no readable text found.` });
          continue;
        }
        add({ id: newId(), name: file.name, source: sourceFor(file), text });
        setStatus({ kind: "idle" });
      } catch (err: unknown) {
        setStatus({ kind: "error", message: err instanceof Error ? err.message : `Couldn't read ${file.name}.` });
      }
    }
  };

  const addPaste = () => {
    if (!pasteText.trim()) return;
    add({
      id: newId(),
      name: pasteName.trim() || "Pasted note",
      source: "paste",
      text: pasteText,
    });
    setPasteName("");
    setPasteText("");
    setPasteOpen(false);
    setStatus({ kind: "idle" });
  };

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-1.5 text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground shrink-0">Context:</span>
          <span className="text-muted-foreground truncate">
            Drop docs here,{" "}
            <Link onClick={() => fileInputRef.current?.click()} hasUnderline>
              browse
            </Link>
            , or{" "}
            <Link onClick={() => setPasteOpen((v) => !v)} hasUnderline>
              paste note
            </Link>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
        {status.kind === "loading" && <span className="text-muted-foreground">Reading…</span>}
        {materials.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
            {materials.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded bg-surface border border-border px-2 py-0.5 text-sm text-foreground shadow-xs"
              >
                <span className="max-w-[130px] truncate">{m.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground ml-0.5 cursor-pointer font-semibold leading-none"
                  onClick={() => remove(m.id)}
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {status.kind === "error" && (
        <Banner status="error" title={status.message ?? "An error occurred."} className="text-sm" />
      )}

      {pasteOpen && (
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/60 p-2 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <TextInput
                label="Label"
                isLabelHidden
                value={pasteName}
                onChange={setPasteName}
                placeholder="Label (e.g. 2024 brag doc)"
              />
            </div>
            <Button
              label="Cancel"
              variant="secondary"
              size="sm"
              onClick={() => setPasteOpen(false)}
            />
            <Button
              label="Add"
              variant="primary"
              size="sm"
              onClick={addPaste}
              isDisabled={!pasteText.trim()}
            />
          </div>
          <TextArea
            label="Paste text"
            isLabelHidden
            value={pasteText}
            onChange={setPasteText}
            placeholder="Paste supporting text here…"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

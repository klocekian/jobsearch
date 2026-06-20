"use client";

import { useRef, useState } from "react";
import { extractFileText, isSupportedFile, SUPPORTED_FORMATS } from "@/lib/extract";
import {
  CONTEXT_CHAR_CAP,
  totalContextChars,
  type ContextMaterial,
} from "@/lib/context";

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
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Context materials</h3>
        <span className="text-xs text-slate-400">Shared across Resume &amp; Cover Letter</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Add supporting materials the AI can draw on — brag docs, project write-ups, past letters,
        performance reviews. Everything stays grounded in what you provide.
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2"
      >
        <span className="text-xs text-slate-500">
          Drop PDF / DOCX / .txt / .md here,{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-medium text-brand hover:underline"
          >
            browse
          </button>
          , or{" "}
          <button
            type="button"
            onClick={() => setPasteOpen((v) => !v)}
            className="font-medium text-brand hover:underline"
          >
            paste a note
          </button>
        </span>
        {status.kind === "loading" && <span className="text-xs text-slate-500">Reading…</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {status.kind === "error" && <p className="mt-2 text-xs text-rose-500">{status.message}</p>}

      {pasteOpen && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            className="input"
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="Label (e.g. 2024 brag doc)"
          />
          <textarea
            className="input h-24 resize-y text-sm"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste any supporting text here…"
          />
          <div className="flex gap-2">
            <button
              onClick={addPaste}
              disabled={!pasteText.trim()}
              className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setPasteOpen(false)}
              className="rounded-md px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {materials.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                <span className="font-medium">{m.name}</span>{" "}
                <span className="text-slate-400">
                  · {m.source === "paste" ? "pasted" : m.source.toUpperCase()} · {m.text.length.toLocaleString()} chars
                </span>
              </span>
              <button
                onClick={() => remove(m.id)}
                aria-label={`Remove ${m.name}`}
                className="shrink-0 rounded px-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

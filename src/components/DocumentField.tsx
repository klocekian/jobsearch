"use client";

import type { ReactNode } from "react";
import Markdown from "react-markdown";

/**
 * The one surface for long-form text — posting, notes, submissions, profile
 * documents, the resume and cover-letter editors. Reading and editing share it:
 * same box, same type, same padding, so switching modes changes nothing but
 * whether you can type (and the focus ring). Edit sits at the left of the
 * toolbar above it; Cancel and Save replace it at the right.
 */
export const DOC_SURFACE = "rounded-md p-3 text-sm leading-relaxed text-primary ring-1 ring-border";

/** The surface while it takes input. */
export const DOC_SURFACE_EDITING = `${DOC_SURFACE} bg-transparent outline-none focus:ring-2 focus:ring-blue-500/40`;

interface DocumentFieldProps {
  /** Accessible name for the text area. */
  label: string;
  /** What reading shows. */
  value: string;
  /** Markdown renders formatted when read; text keeps its line breaks. */
  format?: "text" | "markdown";
  editing?: boolean;
  draft?: string;
  onDraftChange?: (value: string) => void;
  /** Shown when there's nothing to read, and as the text area's placeholder. */
  placeholder?: string;
  /** Fill the remaining height of a flex column (the editor only). */
  fill?: boolean;
  /** Focus the text area when editing starts (off for editors that are always open). */
  autoFocus?: boolean;
  /** Custom reading view, e.g. the posting with its skill highlights. */
  children?: ReactNode;
}

export function DocumentField({
  label, value, format = "text", editing = false, draft = "", onDraftChange, placeholder, fill = false, autoFocus = true, children,
}: DocumentFieldProps) {
  if (editing) {
    return (
      <textarea
        aria-label={label}
        value={draft}
        onChange={(e) => onDraftChange?.(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${DOC_SURFACE_EDITING} block w-full resize-none ${fill ? "min-h-[60dvh] flex-1 md:min-h-0" : "min-h-40 [field-sizing:content]"}`}
      />
    );
  }

  return (
    <div className={DOC_SURFACE}>
      {children ?? (
        !value.trim() ? (
          <span className="text-secondary">{placeholder}</span>
        ) : format === "markdown" ? (
          <div className="prose prose-sm prose-app max-w-none">
            <Markdown>{value}</Markdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{value}</div>
        )
      )}
    </div>
  );
}

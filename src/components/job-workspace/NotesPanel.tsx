"use client";

import { DocumentField } from "../DocumentField";
import type { Draft } from "./useDraft";

interface NotesPanelProps {
  notes: string;
  /** While open, the notes fill the pane; Edit, Cancel and Save live in the tab's toolbar. */
  draft: Draft<string>;
}

/** The job's free-form Markdown notes. */
export function NotesPanel({ notes, draft }: NotesPanelProps) {
  return (
    <DocumentField
      label="Notes"
      value={notes}
      format="markdown"
      editing={draft.isOpen}
      draft={draft.value}
      onDraftChange={draft.set}
      placeholder="No notes yet."
      fill
    />
  );
}

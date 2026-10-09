"use client";

import Markdown from "react-markdown";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Banner } from "@astryxdesign/core/Banner";
import type { Draft } from "./useDraft";

interface NotesPanelProps {
  notes: string;
  draft: Draft<string>;
  onSave: () => void;
}

/** The job's free-form Markdown notes. */
export function NotesPanel({ notes, draft, onSave }: NotesPanelProps) {
  return (
    <div>
      {draft.isOpen ? (
        <div>
          <TextArea label="Notes" isLabelHidden value={draft.value} onChange={draft.set} rows={10} />
          <div className="mt-2 flex gap-2">
            <Button label="Save" variant="primary" size="sm" onClick={onSave} />
            <Button label="Cancel" variant="secondary" size="sm" onClick={draft.close} />
          </div>
        </div>
      ) : (
        <div>
          <Button label={notes ? "Edit notes" : "Add notes"} variant="secondary" size="sm" onClick={() => draft.open(notes)} />
          {notes ? (
            <div className="prose prose-sm mt-3 max-w-none">
              <Markdown>{notes}</Markdown>
            </div>
          ) : (
            <div className="mt-3">
              <Banner status="info" title="No notes yet." />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

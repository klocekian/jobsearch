"use client";

import { useRef } from "react";
import { readResumeFile } from "@/lib/extract";
import { apiSend, errorMessage } from "@/lib/api-client";
import type { ResumeRow } from "@/lib/db/resumes";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";

interface ResumePickerProps {
  resumes: ResumeRow[];
  resumeText: string;
  onPick: (text: string) => void;
  /** A file was uploaded and saved as a new resume. */
  onAdded: (resume: ResumeRow) => void;
  /** Upload failures; called with null when a new upload starts. */
  onError: (message: string | null) => void;
}

/** Choose which saved resume to analyze, or upload a new one. */
export function ResumePicker({ resumes, resumeText, onPick, onAdded, onError }: ResumePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2 min-w-0">
      {resumes.length > 0 ? (
        <Selector
          label="Resume"
          isLabelHidden
          className="max-w-[220px]"
          options={[
            ...resumes.map(r => ({ value: String(r.id), label: `${r.name}${r.is_default ? " (default)" : ""}` })),
            { value: "__add_new__", label: "+ Add resume…" },
          ]}
          value={String(resumes.find(r => r.content === resumeText)?.id ?? "")}
          onChange={(v) => {
            if (v === "__add_new__") {
              fileRef.current?.click();
              return;
            }
            const r = resumes.find(r => r.id === Number(v));
            if (r) onPick(r.content);
          }}
        />
      ) : (
        <Button label="+ Add resume" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} />
      )}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".txt,.md,.pdf,.docx"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = "";
          onError(null);
          try {
            const { text, name } = await readResumeFile(file);
            const d = await apiSend<{ resume: ResumeRow }>("/api/resumes", "POST", {
              name: name.replace(/[^a-zA-Z0-9]/g, "_"),
              content: text,
            });
            onAdded(d.resume);
          } catch (err) {
            onError(errorMessage(err, `Couldn't add ${file.name}.`));
          }
        }}
      />
    </div>
  );
}

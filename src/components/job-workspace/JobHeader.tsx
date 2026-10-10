"use client";

import type { JobRow } from "@/lib/db/jobs";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Banner } from "@astryxdesign/core/Banner";
import { HStack } from "@astryxdesign/core/Stack";
import type { Draft } from "./useDraft";

export type HeaderFields = Pick<JobRow, "title" | "company" | "location" | "salary_text" | "url">;

export const EMPTY_HEADER: HeaderFields = { title: "", company: "", location: "", salary_text: "", url: "" };

interface JobHeaderProps {
  job: JobRow;
  draft: Draft<HeaderFields>;
  onSave: () => void;
  onRestoreStatus: (status: string) => void;
  onDelete: () => void;
  error: string | null;
  onDismissError: () => void;
}

export function JobHeader({ job, draft, onSave, onRestoreStatus, onDelete, error, onDismissError }: JobHeaderProps) {
  const fields = draft.value;
  const setField = (key: keyof HeaderFields) => (v: string) => draft.set({ ...fields, [key]: v });

  return (
    <div className="min-w-0 flex-1">
      {draft.isOpen ? (
        <div className="mt-1 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <TextInput label="Job title" isLabelHidden value={fields.title} onChange={setField("title")} placeholder="Job title" />
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button label="Cancel" variant="secondary" size="sm" onClick={draft.close} />
              <Button label="Save" variant="primary" size="sm" onClick={onSave} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <TextInput label="Company" isLabelHidden value={fields.company} onChange={setField("company")} placeholder="Company" />
            <TextInput label="Location" isLabelHidden value={fields.location} onChange={setField("location")} placeholder="Location" />
            <TextInput label="Salary" isLabelHidden value={fields.salary_text} onChange={setField("salary_text")} placeholder="Salary" />
            <TextInput label="URL" isLabelHidden value={fields.url} onChange={setField("url")} placeholder="URL" />
          </div>
        </div>
      ) : (
        <div>
          <HStack gap={2} className="w-full items-center">
            <Heading level={2}>{job.title || "Untitled"}</Heading>
            <Button
              label="Edit"
              variant="secondary"
              size="sm"
              onClick={() => draft.open({ title: job.title, company: job.company, location: job.location, salary_text: job.salary_text, url: job.url })}
            />
            <span className="ml-auto">
              <Button label="Delete" variant="ghost" size="sm" onClick={onDelete} />
            </span>
          </HStack>
          <Text type="supporting" display="block">
            {job.company}
            {job.location && <> · {job.location}</>}
            {job.salary_text && <> · {job.salary_text}</>}
          </Text>
          {job.status === "closed" && !!job.auto_closed && job.previous_status && (
            <div className="mt-2 flex items-center justify-between p-2 px-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 text-sm">
              <span>This job was auto-marked closed (previously <strong>{job.previous_status}</strong>).</span>
              <button
                type="button"
                onClick={() => onRestoreStatus(job.previous_status!)}
                className="font-semibold underline hover:no-underline ml-2 cursor-pointer"
              >
                Restore to {job.previous_status}
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Banner status="error" title={error} isDismissable onDismiss={onDismissError} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef } from "react";
import Markdown from "react-markdown";
import type { SubmissionRow } from "@/lib/db/submissions";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Stack, HStack } from "@astryxdesign/core/Stack";

interface SubmissionsPanelProps {
  jobId: number;
  submissions: SubmissionRow[];
  /** Offered once there's an analysis to package. */
  onSavePackage: (() => void) | null;
  onUpload: (file: File) => void;
  onRemove: (submissionId: number) => void;
  /** The submission whose content is expanded, if any. */
  viewingId: number | null;
  onViewingChange: (submissionId: number | null) => void;
}

/** What was (or will be) sent for this job: uploaded files and saved application packages. */
export function SubmissionsPanel({
  jobId, submissions, onSavePackage, onUpload, onRemove, viewingId, onViewingChange,
}: SubmissionsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Stack gap={3}>
      <HStack gap={2}>
        <Button label="Upload file" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ""; }} />
        {onSavePackage && (
          <Button
            label="Save package"
            variant="ghost"
            size="sm"
            onClick={onSavePackage}
          />
        )}
      </HStack>
      {submissions.length === 0 ? (
        <Banner status="info" title="No submissions yet." />
      ) : (
        <Stack gap={2}>
          {submissions.map((s) => (
            <Card key={s.id}>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <Text weight="semibold" display="block">{s.label}</Text>
                    <Text type="supporting" display="block">{s.type} · {s.format}</Text>
                  </div>
                  <HStack gap={2}>
                    {s.content && (
                      <Button
                        label={viewingId === s.id ? "Close" : "View"}
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewingChange(viewingId === s.id ? null : s.id)}
                      />
                    )}
                    <Button label="Download" variant="ghost" size="sm" href={`/api/jobs/${jobId}/submissions/${s.id}?download=1`} />
                    <Button label="Remove" variant="ghost" size="sm" onClick={() => onRemove(s.id)} />
                  </HStack>
                </div>
                {viewingId === s.id && s.content && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="prose prose-sm max-w-none">
                      <Markdown>{s.content}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

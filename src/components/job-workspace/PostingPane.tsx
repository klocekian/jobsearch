"use client";

import type { JobRow } from "@/lib/db/jobs";
import type { MatchReport } from "@/lib/analysis/types";
import { JobDescriptionView } from "../JobDescriptionView";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Text } from "@astryxdesign/core/Text";
import { Link as AstryxLink } from "@astryxdesign/core/Link";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import type { Draft } from "./useDraft";

export type LeftTab = "posting" | "apply";

interface PostingPaneProps {
  tab: LeftTab;
  job: JobRow;
  /** The current match, whose skills are highlighted in the posting. */
  report: MatchReport | null;
  paste: Draft<string>;
  onSavePaste: () => void;
}

/** Left pane: the posting text (with skill highlights) or the embedded application form. */
export function PostingPane({ tab, job, report, paste, onSavePaste }: PostingPaneProps) {
  if (tab === "apply") {
    return job.url ? (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-center gap-2">
          <AstryxLink href={job.url} isExternalLink>Open in new tab</AstryxLink>
          <Text type="supporting">Many sites block embedding — use the link above if the form doesn&apos;t load below.</Text>
        </div>
        <iframe src={job.url} className="flex-1 w-full rounded-lg border border-border" title="Application" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
      </div>
    ) : (
      <Banner status="info" title="No URL saved for this job. Add one to open the application here." />
    );
  }

  return (
    <div className="space-y-3">
      {!paste.isOpen && (
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
          {report && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-4 rounded bg-rose-600 dark:bg-rose-400" />
                <Text type="supporting">Missing Skills</Text>
              </div>
              <div className="flex items-center gap-1.5 mr-1">
                <span className="inline-block h-1 w-4 rounded bg-emerald-600 dark:bg-emerald-400" />
                <Text type="supporting">Matched Skills</Text>
              </div>
            </>
          )}
          <Button label={job.posting_text ? "Update posting" : "Paste posting"} variant="secondary" size="sm" onClick={() => paste.open("")} />
          {job.url && (
            <AstryxLink href={job.url} isExternalLink>Open original</AstryxLink>
          )}
        </div>
      )}
      {paste.isOpen && (
        <div className="rounded-lg border border-border bg-muted p-3">
          <TextArea label="Paste posting" isLabelHidden value={paste.value} onChange={paste.set} placeholder="Paste job posting text…" rows={6} />
          <div className="mt-2 flex gap-2">
            <Button label="Save" variant="primary" size="sm" onClick={onSavePaste} isDisabled={!paste.value.trim()} />
            <Button label="Cancel" variant="secondary" size="sm" onClick={paste.close} />
          </div>
        </div>
      )}
      {job.posting_text ? (
        report ? (
          <JobDescriptionView
            jobText={job.posting_text}
            jobTitle={job.title}
            matched={report.highlights.matched}
            missing={report.highlights.missing}
            hideLegend
          />
        ) : (
          <Card className="p-4 sm:p-5">
            <Text display="block" className="whitespace-pre-wrap text-xs leading-relaxed">{job.posting_text}</Text>
          </Card>
        )
      ) : (
        <Banner status="info" title="No posting text. Paste it above or use the Chrome extension." />
      )}
    </div>
  );
}

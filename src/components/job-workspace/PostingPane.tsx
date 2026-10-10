"use client";

import type { JobRow } from "@/lib/db/jobs";
import type { MatchReport } from "@/lib/analysis/types";
import { JobDescriptionView } from "../JobDescriptionView";
import { DocumentField } from "../DocumentField";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Link as AstryxLink } from "@astryxdesign/core/Link";
import { Banner } from "@astryxdesign/core/Banner";
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
        <iframe src={job.url} className="min-h-[70dvh] flex-1 w-full rounded-lg border border-border md:min-h-0" title="Application" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
      </div>
    ) : (
      <Banner status="info" title="No URL saved for this job. Add one to open the application here." />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {paste.isOpen ? (
          <>
            <Button label="Cancel" variant="secondary" size="sm" onClick={paste.close} />
            <Button label="Save" variant="primary" size="sm" onClick={onSavePaste} isDisabled={!paste.value.trim()} />
          </>
        ) : (
          <>
            <span className="mr-auto">
              <Button label={job.posting_text ? "Edit" : "Paste posting"} variant="secondary" size="sm" onClick={() => paste.open(job.posting_text)} />
            </span>
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
            {job.url && (
              <AstryxLink href={job.url} isExternalLink>Open original</AstryxLink>
            )}
          </>
        )}
      </div>
      <DocumentField
        label="Job posting"
        value={job.posting_text}
        editing={paste.isOpen}
        draft={paste.value}
        onDraftChange={paste.set}
        placeholder="No posting text. Paste it here, or clip it with the Chrome extension."
      >
        {report && job.posting_text ? (
          <JobDescriptionView
            jobText={job.posting_text}
            jobTitle={job.title}
            matched={report.highlights.matched}
            missing={report.highlights.missing}
            hideLegend
          />
        ) : undefined}
      </DocumentField>
    </div>
  );
}

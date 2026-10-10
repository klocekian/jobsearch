"use client";

import type { JobRow } from "@/lib/db/jobs";
import type { MatchReport } from "@/lib/analysis/types";
import { JobDescriptionView } from "../JobDescriptionView";
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
        <iframe src={job.url} className="flex-1 w-full rounded-lg border border-border" title="Application" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
      </div>
    ) : (
      <Banner status="info" title="No URL saved for this job. Add one to open the application here." />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
        {paste.isOpen ? (
          <>
            <Button label="Cancel" variant="secondary" size="sm" onClick={paste.close} />
            <Button label="Save" variant="primary" size="sm" onClick={onSavePaste} isDisabled={!paste.value.trim()} />
          </>
        ) : (
          <>
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
            <Button label={job.posting_text ? "Edit" : "Paste posting"} variant="secondary" size="sm" onClick={() => paste.open(job.posting_text)} />
            {job.url && (
              <AstryxLink href={job.url} isExternalLink>Open original</AstryxLink>
            )}
          </>
        )}
      </div>
      {paste.isOpen ? (
        // The posting itself becomes editable, in place and in the same type.
        <textarea
          aria-label="Job posting"
          value={paste.value}
          onChange={(e) => paste.set(e.target.value)}
          placeholder="Paste job posting text…"
          autoFocus
          className="-mx-2 block min-h-[50vh] w-[calc(100%+1rem)] resize-none rounded-md bg-transparent p-2 font-sans text-xs leading-relaxed text-primary outline-none ring-1 ring-border [field-sizing:content] focus:ring-2 focus:ring-blue-500/40"
        />
      ) : job.posting_text ? (
        report ? (
          <JobDescriptionView
            jobText={job.posting_text}
            jobTitle={job.title}
            matched={report.highlights.matched}
            missing={report.highlights.missing}
            hideLegend
          />
        ) : (
          <Text display="block" className="whitespace-pre-wrap text-xs leading-relaxed">{job.posting_text}</Text>
        )
      ) : (
        <Banner status="info" title="No posting text. Paste it above or use the Chrome extension." />
      )}
    </div>
  );
}

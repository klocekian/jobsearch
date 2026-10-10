"use client";

import type { JobRow } from "@/lib/db/jobs";
import { FitnessReportView } from "../FitnessReportView";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Badge } from "@astryxdesign/core/Badge";
import { WithAiToggle } from "./WithAiToggle";
import type { useFitness } from "./useFitness";

interface FitnessTabProps {
  job: JobRow;
  fitness: ReturnType<typeof useFitness>;
  withAi: boolean;
  onWithAiChange: (value: boolean) => void;
  onEditProfile: () => void;
}

/** Profile tab: how well the posting fits the candidate profile and gaps. */
export function FitnessTab({ job, fitness, withAi, onWithAiChange, onEditProfile }: FitnessTabProps) {
  const { saved, runAt, method, running, saving, error, notesFlash } = fitness;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          label="Edit"
          variant="secondary"
          size="sm"
          onClick={onEditProfile}
        />

        <div className="flex shrink-0 items-center gap-2">
          <WithAiToggle checked={withAi} onChange={onWithAiChange} />
          <Button
            label={running ? "Analyzing…" : saved ? "Re-run analysis" : "Analyze"}
            variant="primary"
            size="sm"
            onClick={() => fitness.run(withAi)}
            isDisabled={running || !job.posting_text.trim()}
          />
        </div>
      </div>

      <div className="py-2">
        {notesFlash && (
          <div className="mb-4">
            <Badge variant="success" label="Added to notes" />
          </div>
        )}

        {error && (
          <div className="mb-4">
            <Banner status="error" title={error} />
          </div>
        )}
        {running && (
          <div className="flex items-center gap-2 py-8">
            <Spinner />
            <Text type="supporting" color="secondary">
              Scoring against your profile and gaps…
            </Text>
          </div>
        )}

        {!running && !saved && !error && (
          <Banner
            status="info"
            title={job.posting_text.trim()
              ? 'Click "Analyze" to run fitness check against your candidate profile.'
              : "Add the posting text first — the fitness check reads the posting, not the resume."}
          />
        )}

        {!running && saved && (
          <FitnessReportView
            result={saved}
            runAt={runAt}
            model={method}
            busy={saving}
            onAddToNotes={() => fitness.addToNotes(false)}
            onAbandon={() => fitness.addToNotes(true)}
          />
        )}
      </div>
    </>
  );
}

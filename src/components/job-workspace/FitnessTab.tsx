"use client";

import type { JobRow } from "@/lib/db/jobs";
import type { AnalysisRunMeta } from "@/lib/db/analysis-runs";
import { FitnessReportView } from "../FitnessReportView";
import { RunHistory, runDate, runMethodLabel } from "../RunHistory";
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
  runs: AnalysisRunMeta[];
  withAi: boolean;
  onWithAiChange: (value: boolean) => void;
  onEditProfile: () => void;
}

/** Profile tab: how well the posting fits the candidate profile and gaps. */
export function FitnessTab({ job, fitness, runs, withAi, onWithAiChange, onEditProfile }: FitnessTabProps) {
  const { saved, shown, shownRunAt, shownMethod, viewed, running, saving, error, notesFlash, restoring } = fitness;

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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {!running && (runs.length > 0 ? (
            <RunHistory
              runs={runs}
              currentRunId={job.fitness_run_id}
              viewingRunId={viewed?.id ?? null}
              outOf={10}
              onView={fitness.view}
              onMakeCurrent={fitness.restore}
              busy={restoring}
            />
          ) : job.fitness_run_at && (
            <Text type="supporting" color="secondary">
              Last run {new Date(job.fitness_run_at).toLocaleString()}
            </Text>
          ))}
          {notesFlash && <Badge variant="success" label="Added to notes" />}
        </div>

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

        {!running && !shown && !error && (
          <Banner
            status="info"
            title={job.posting_text.trim()
              ? 'Click "Analyze" to run fitness check against your candidate profile.'
              : "Add the posting text first — the fitness check reads the posting, not the resume."}
          />
        )}

        {!running && shown && (
          <FitnessReportView
            result={shown}
            runAt={shownRunAt ? runDate(shownRunAt).toISOString() : null}
            model={shownMethod ? runMethodLabel({ kind: "fitness", method: shownMethod, resume_name: null }) : null}
            busy={saving}
            onAddToNotes={() => fitness.addToNotes(false)}
            onAbandon={() => fitness.addToNotes(true)}
          />
        )}
      </div>
    </>
  );
}

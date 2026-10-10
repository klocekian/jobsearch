"use client";

import { useEffect, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { apiGet } from "@/lib/api-client";
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

/** Which candidate documents are still empty — the fitness check is grounded in both. Null until known. */
function useMissingCandidateDocs(): string[] | null {
  const [missing, setMissing] = useState<string[] | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<{ profile?: string; gaps?: string }>("/api/candidate-docs")
      .then((d) => {
        if (active) setMissing([!d.profile?.trim() && "positive profile", !d.gaps?.trim() && "negative profile"].filter(Boolean) as string[]);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return missing;
}

/** Profile tab: how well the posting fits the candidate profile and gaps. */
export function FitnessTab({ job, fitness, withAi, onWithAiChange, onEditProfile }: FitnessTabProps) {
  const { saved, runAt, method, running, saving, error, notesFlash } = fitness;
  const missingDocs = useMissingCandidateDocs();

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
          <Button
            label={running ? "Analyzing…" : saved ? "Re-run analysis" : "Analyze"}
            variant="primary"
            size="sm"
            onClick={() => fitness.run(withAi)}
            isDisabled={running || !job.posting_text.trim()}
          />
          <WithAiToggle checked={withAi} onChange={onWithAiChange} />
        </div>
      </div>

      {missingDocs && missingDocs.length > 0 && (
        <>
          <Banner
            status="warning"
            title={`Add your ${missingDocs.join(" and ")} to ground the fitness check.`}
            description="The AI check won't run without both; the rule-based check scores against your default resume instead."
            // On a phone the button beside the text squeezes it into a sliver; it goes below instead.
            endContent={<div className="hidden md:block"><Button label="Open Tools › Profile" variant="secondary" size="sm" onClick={onEditProfile} /></div>}
          />
          <div className="md:hidden">
            <Button label="Open Tools › Profile" variant="secondary" size="sm" onClick={onEditProfile} />
          </div>
        </>
      )}

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

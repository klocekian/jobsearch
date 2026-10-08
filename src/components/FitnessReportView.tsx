"use client";

import type { FitnessResult, FitnessRequirement } from "@/lib/fitness/schema";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";

/**
 * Renders a fitness check.
 *
 * Design rule carried over from the CLI: every requirement appears verbatim
 * next to its verdict, so the whole report is auditable in about fifteen
 * seconds. Quotes are visually distinct from the notes about them — the quote
 * is what the posting said, the note is the tool's reasoning, and blurring
 * those two is how a softened verdict slips past.
 */

const EMPLOYER_TYPE_LABELS: Record<string, string> = {
  in_house: "In-house / end-user",
  vendor: "Vendor / product company",
  consultancy: "Consultancy / SI / staffing",
  unknown: "Employer type not stated",
};

const VERDICT_VARIANTS: Record<string, "success" | "warning" | "error" | "neutral"> = {
  MEET: "success",
  ADJACENT: "warning",
  MISS: "error",
};

function VerdictRow({ item }: { item: FitnessRequirement }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 px-3.5 py-2.5 text-xs">
      <div>
        <Badge variant={VERDICT_VARIANTS[item.verdict] ?? "neutral"} label={item.verdict} />
      </div>
      <div className="min-w-0">
        <blockquote className="border-l-2 border-border pl-2.5">
          <Text className="italic text-xs leading-snug">{item.verbatim}</Text>
        </blockquote>
        {item.note && (
          <div className="mt-1">
            <Text type="supporting" color="secondary" className="text-xs">{item.note}</Text>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <Text type="label" weight="semibold" display="block" className="text-xs uppercase tracking-wider text-muted-foreground">{title}</Text>
      {subtitle && (
        <div className="mb-1.5 mt-0.5">
          <Text type="supporting" color="secondary" className="text-xs">{subtitle}</Text>
        </div>
      )}
      <div className={subtitle ? "" : "mt-1.5"}>
        <Card className="overflow-hidden">{children}</Card>
      </div>
    </section>
  );
}

export interface FitnessReportViewProps {
  result: FitnessResult;
  runAt?: string | null;
  model?: string | null;
  /**
   * Decision-level actions. The report itself is persisted automatically on
   * completion (like the ATS report); these two change the job, so they stay
   * behind an explicit press.
   */
  onAddToNotes?: () => void;
  onAbandon?: () => void;
  busy?: boolean;
}

export function FitnessReportView({
  result,
  runAt,
  model,
  onAddToNotes,
  onAbandon,
  busy,
}: FitnessReportViewProps) {
  const objective = result.stated_minimums.filter((m) => m.kind !== "dispositional");
  const dispositional = result.stated_minimums.filter((m) => m.kind === "dispositional");
  const hasActions = Boolean(onAddToNotes || onAbandon);

  return (
    <div className="space-y-3 pb-6 text-xs">
      {result.hard_stop.triggered && (
        <div className="mb-3">
          <Banner
            status="error"
            title="Hard stop"
            description={result.hard_stop.reason || "A stated requirement triggers a hard stop."}
          />
        </div>
      )}

      {/* Score header */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">{result.score}</span>
          <span className="text-xs text-muted-foreground">/ 10</span>
          <div className="ml-auto">
            <Badge
              variant={result.verdict === "APPLY" ? "success" : "error"}
              label={result.verdict === "APPLY" ? "Apply" : "Do not pursue"}
            />
          </div>
        </div>
        <div className="mt-1.5">
          <Text className="text-xs leading-relaxed">{result.one_line}</Text>
        </div>
        <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <div>{result.company} — {result.title}</div>
          <div>{result.location} · {result.work_arrangement} · travel {result.travel_percent} · {result.salary}</div>
        </div>
      </Card>

      {/* The report is already saved. These change the job, so they wait for
          a press — automating the decision is how you stop reading the report
          that informs it. */}
      {hasActions && (
        <div className="flex flex-wrap items-center gap-2">
          {onAddToNotes && (
            <Button
              label={busy ? "Working…" : "Add to notes"}
              variant="secondary"
              size="sm"
              onClick={onAddToNotes}
              isDisabled={busy}
            />
          )}
          {onAbandon && result.verdict === "DO_NOT_PURSUE" && (
            <Button
              label="Add to notes and abandon"
              variant="secondary"
              size="sm"
              onClick={onAbandon}
              isDisabled={busy}
            />
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Card className="px-3.5 py-2.5">
          <Text type="supporting" color="secondary" display="block" className="text-[11px]">Employer type</Text>
          <div className="mt-0.5">
            <Text weight="semibold" className="text-xs">
              {EMPLOYER_TYPE_LABELS[result.employer_type] ?? result.employer_type}
            </Text>
          </div>
          {result.employer_type_note && (
            <div className="mt-0.5">
              <Text type="supporting" color="secondary" className="text-xs">{result.employer_type_note}</Text>
            </div>
          )}
        </Card>
        <Card className="px-3.5 py-2.5">
          <Text type="supporting" color="secondary" display="block" className="text-[11px]">
            Logistics (light touch at this stage)
          </Text>
          <div className="mt-0.5">
            <Text className="text-xs">{result.logistics_note}</Text>
          </div>
        </Card>
      </div>

      <Section title={`Stated minimums, objective (${objective.length})`}>
        {objective.length === 0 ? (
          <div className="px-3.5 py-2.5">
            <Text color="secondary" className="text-xs">Posting states no checkable minimums.</Text>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {objective.map((m, i) => (
              <VerdictRow key={`${i}-${m.verbatim.slice(0, 24)}`} item={m} />
            ))}
          </div>
        )}
      </Section>

      {dispositional.length > 0 && (
        <Section
          title={`Dispositional (${dispositional.length})`}
          subtitle="Interview material — never scored."
        >
          <div className="divide-y divide-border">
            {dispositional.map((m, i) => (
              <VerdictRow key={`${i}-${m.verbatim.slice(0, 24)}`} item={m} />
            ))}
          </div>
        </Section>
      )}

      {result.preferred.length > 0 && (
        <Section title="Preferred" subtitle="Informs the score modestly, never decisively.">
          <div className="divide-y divide-border">
            {result.preferred.map((p, i) => (
              <div key={`${i}-${p.verbatim.slice(0, 24)}`} className="grid grid-cols-[92px_1fr] gap-3 px-5 py-3">
                <div>
                  <Badge variant={VERDICT_VARIANTS[p.verdict] ?? "neutral"} label={p.verdict} />
                </div>
                <blockquote className="border-l-2 border-border pl-3">
                  <Text type="body" className="italic">{p.verbatim}</Text>
                </blockquote>
              </div>
            ))}
          </div>
        </Section>
      )}

      {result.gaps.length > 0 && (
        <Section
          title="Gaps and framings"
          subtitle="A prepared response, not a defense. Rehearse these aloud before the call."
        >
          <div className="divide-y divide-border">
            {result.gaps.map((g, i) => (
              <div key={`${i}-${g.gap.slice(0, 24)}`} className="px-5 py-4">
                <Text type="body" weight="semibold" display="block">{g.gap}</Text>
                <div className="mt-1">
                  <Text type="body" color="secondary">{g.framing}</Text>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Outcome spectrum">
        <div className="divide-y divide-border">
          {[
            ["Best case", result.outcomes.best_case],
            ["Probable", result.outcomes.probable],
            ["Worst case", result.outcomes.worst_case],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3">
              <Text type="supporting" color="secondary">{label}</Text>
              <Text type="body">{value}</Text>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tradeoffs of pursuing">
        <div className="divide-y divide-border">
          <div className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3">
            <Text type="supporting" color="secondary">Gained</Text>
            <Text type="body">{result.tradeoffs.gained}</Text>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3">
            <Text type="supporting" color="secondary">Lost</Text>
            <Text type="body">{result.tradeoffs.lost}</Text>
          </div>
        </div>
      </Section>

      {(runAt || model) && (
        <div className="mt-6">
          <Text type="supporting" color="secondary">
            {runAt ? `Run ${new Date(runAt).toLocaleString()}` : ""}
            {runAt && model ? " · " : ""}
            {model ?? ""}
          </Text>
        </div>
      )}
    </div>
  );
}

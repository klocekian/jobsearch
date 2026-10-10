"use client";

import type { FitnessResult, FitnessRequirement } from "@/lib/fitness/schema";
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

// Same pill as the job status in the activity banner (lib/status.ts).
const PILL_TONES = {
  good: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  partial: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  bad: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  neutral: "bg-muted text-secondary",
} as const;

const VERDICT_TONES: Record<string, keyof typeof PILL_TONES> = {
  MEET: "good",
  ADJACENT: "partial",
  MISS: "bad",
};

function Pill({ tone, label }: { tone: keyof typeof PILL_TONES; label: string }) {
  return (
    <span className={`inline-block rounded-full px-1.5 text-[9px] font-semibold leading-4 tracking-wide ${PILL_TONES[tone]}`}>{label}</span>
  );
}

function VerdictRow({ item }: { item: FitnessRequirement }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2 py-2.5 text-xs">
      <div>
        <Pill tone={VERDICT_TONES[item.verdict] ?? "neutral"} label={item.verdict} />
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
    <section>
      <Text type="label" weight="semibold" display="block" className="text-xs uppercase tracking-wider text-muted-foreground">{title}</Text>
      {subtitle && (
        <div className="mt-0.5">
          <Text type="supporting" color="secondary" className="text-xs">{subtitle}</Text>
        </div>
      )}
      <div className="mt-1">{children}</div>
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
    // One rule between sections, no boxes.
    <div className="divide-y divide-border pb-6 text-xs [&>*]:py-4 [&>*:first-child]:pt-0">
      {result.hard_stop.triggered && (
        <div>
          <Banner
            status="error"
            title="Hard stop"
            description={result.hard_stop.reason || "A stated requirement triggers a hard stop."}
          />
        </div>
      )}

      {/* Score header, and the actions on it */}
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">{result.score}</span>
          <span className="text-xs text-muted-foreground">/ 10</span>
          <div className="ml-auto">
            <Pill
              tone={result.verdict === "APPLY" ? "good" : "bad"}
              label={result.verdict === "APPLY" ? "Apply" : "Do not pursue"}
            />
          </div>
        </div>
        <div className="mt-1.5">
          <Text className="text-xs leading-relaxed">{result.one_line}</Text>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          <div>{result.company} — {result.title}</div>
          <div>{result.location} · {result.work_arrangement} · travel {result.travel_percent} · {result.salary}</div>
        </div>

        {/* The report is already saved. These change the job, so they wait for
            a press — automating the decision is how you stop reading the report
            that informs it. */}
        {hasActions && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
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
        </div>
        <div>
          <Text type="supporting" color="secondary" display="block" className="text-[11px]">
            Logistics (light touch at this stage)
          </Text>
          <div className="mt-0.5">
            <Text className="text-xs">{result.logistics_note}</Text>
          </div>
        </div>
      </div>

      <Section title={`Stated minimums, objective (${objective.length})`}>
        {objective.length === 0 ? (
          <div className="py-2.5">
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
              <div key={`${i}-${p.verbatim.slice(0, 24)}`} className="grid grid-cols-[64px_1fr] gap-2 py-2.5 text-xs">
                <div>
                  <Pill tone={VERDICT_TONES[p.verdict] ?? "neutral"} label={p.verdict} />
                </div>
                <blockquote className="border-l-2 border-border pl-2.5">
                  <Text className="italic text-xs leading-snug">{p.verbatim}</Text>
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
              <div key={`${i}-${g.gap.slice(0, 24)}`} className="py-2.5">
                <Text weight="semibold" display="block" className="text-xs">{g.gap}</Text>
                <div className="mt-1">
                  <Text color="secondary" className="text-xs">{g.framing}</Text>
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
            <div key={label} className="grid grid-cols-[80px_1fr] gap-2 py-2.5">
              <Text color="secondary" className="text-xs">{label}</Text>
              <Text className="text-xs">{value}</Text>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tradeoffs of pursuing">
        <div className="divide-y divide-border">
          <div className="grid grid-cols-[80px_1fr] gap-2 py-2.5">
            <Text color="secondary" className="text-xs">Gained</Text>
            <Text className="text-xs">{result.tradeoffs.gained}</Text>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2 py-2.5">
            <Text color="secondary" className="text-xs">Lost</Text>
            <Text className="text-xs">{result.tradeoffs.lost}</Text>
          </div>
        </div>
      </Section>

      {(runAt || model) && (
        <div>
          <Text type="supporting" color="secondary" className="text-xs">
            {runAt ? `Run ${new Date(runAt).toLocaleString()}` : ""}
            {runAt && model ? " · " : ""}
            {model ?? ""}
          </Text>
        </div>
      )}
    </div>
  );
}

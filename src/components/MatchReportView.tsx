"use client";

import { useState } from "react";
import type {
  MatchReport,
  SearchabilityGroup,
  SkillSection,
  RecruiterTip,
  AiDetection,
} from "@/lib/analysis/types";
import { StatusIcon, ScoreRing } from "./icons";
import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Card } from "@astryxdesign/core/Card";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { Text } from "@astryxdesign/core/Text";

import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";

/** Async state of the LLM-based AI-authorship check (owned by App). */
export interface AiDetectionState {
  status: "loading" | "done" | "error";
  /** LLM result when done; heuristic fallback on error; may be null while loading. */
  data: AiDetection | null;
}

export type ReportSubTab = "match" | "ai";

interface MatchReportViewProps {
  report: MatchReport;
  aiDetection: AiDetectionState;
  onRunAnalysis?: () => void;
  analysisDisabled?: boolean;
  hasAnalysis?: boolean;
  subTab?: ReportSubTab;
  onSubTabChange?: (tab: ReportSubTab) => void;
  hideSegmentedControl?: boolean;
}

function SummaryCards({ report }: { report: MatchReport }) {
  const cards = [
    { label: "Hard Skills", n: report.counts.hardSkillsIssues },
    { label: "Soft Skills", n: report.counts.softSkillsIssues },
    { label: "Searchability", n: report.counts.searchabilityIssues },
    { label: "Recruiter Tips", n: report.counts.recruiterIssues },
  ];
  return (
    <div className="flex items-center gap-3">
      <ScoreRing score={report.score} size={60} />
      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="px-3 py-2">
            <Text type="supporting" color="secondary" display="block" className="text-xs">{c.label}</Text>
            <div className="mt-0.5">
              <span className={`text-base font-semibold ${c.n === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
                {c.n}
              </span>{" "}
              <span className="text-xs text-muted-foreground">{c.n === 1 ? "issue" : "issues"}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <Text type="label" weight="semibold" display="block" className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">{title}</Text>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

function SearchabilityTable({ groups }: { groups: SearchabilityGroup[] }) {
  return (
    <div className="divide-y divide-border text-xs">
      {groups.map((g) => (
        <div key={g.label} className="grid grid-cols-1 gap-1.5 px-3.5 py-2 sm:grid-cols-[130px_1fr]">
          <Text weight="semibold" display="block" className="text-xs">{g.label}</Text>
          <ul className="space-y-1">
            {g.items.map((item, i) => (
              <li key={i} className="flex gap-2 leading-snug">
                <StatusIcon status={item.status} className="h-4 w-4 shrink-0 mt-0.5" />
                <Text color="secondary" className="text-xs">{item.message}</Text>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SkillsTable({ section, title }: { section: SkillSection; title: string }) {
  return (
    <div className="text-xs">
      <div className="flex items-center gap-3 border-b border-border px-3.5 py-1.5 bg-muted/30">
        <Text weight="semibold" className="text-xs">{title}</Text>
        <Text color="secondary" className="text-xs">
          Matched <Text weight="semibold" className="text-emerald-600 dark:text-emerald-400 text-xs">{section.matched}</Text>
        </Text>
        <Text color="secondary" className="text-xs">
          Missing <Text weight="semibold" className="text-rose-500 dark:text-rose-400 text-xs">{section.missing}</Text>
        </Text>
      </div>
      {section.rows.length === 0 ? (
        <Text type="supporting" color="secondary" display="block" className="px-3.5 py-2 text-xs">No skills of this type detected in the job description.</Text>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
              <th className="px-3.5 py-1 text-[11px] font-medium">Skill</th>
              <th className="px-3.5 py-1 text-right text-[11px] font-medium">Resume</th>
              <th className="px-3.5 py-1 text-right text-[11px] font-medium">Job</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {section.rows.map((row) => (
              <tr key={row.skill} className="hover:bg-muted/30">
                <td className="px-3.5 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusIcon status={row.state === "missing" ? "fail" : "pass"} className="h-3.5 w-3.5 shrink-0" />
                    <Text className="text-xs">{row.skill}</Text>
                    {row.state === "exceeds" && (
                      <Badge variant="warning" label="over-indexed" />
                    )}
                  </span>
                </td>
                <td className="px-3.5 py-1.5 text-right tabular-nums text-xs">
                  {row.state === "missing" ? <Text className="text-rose-400 text-xs">✕</Text> : <Text className="text-xs">{row.resumeCount}</Text>}
                </td>
                <td className="px-3.5 py-1.5 text-right tabular-nums text-xs"><Text className="text-xs">{row.jobCount}</Text></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RecruiterTable({ tips }: { tips: RecruiterTip[] }) {
  return (
    <div className="divide-y divide-border text-xs">
      {tips.map((t) => (
        <div key={t.label} className="grid grid-cols-1 gap-1.5 px-3.5 py-2 sm:grid-cols-[130px_1fr]">
          <Text weight="semibold" display="block" className="text-xs">{t.label}</Text>
          <div className="space-y-1">
            <div className="flex gap-2 leading-snug">
              <StatusIcon status={t.status} className="h-4 w-4 shrink-0 mt-0.5" />
              <Text color="secondary" className="text-xs">{t.message}</Text>
            </div>
            {t.evidence && t.evidence.length > 0 && (
              <div className="ml-6 rounded bg-muted px-2.5 py-1">
                <Text type="supporting" weight="semibold" display="block" className="mb-0.5 text-[10px] uppercase tracking-wide">
                  Evidence
                </Text>
                <ul className="space-y-0.5 italic text-xs">
                  {t.evidence.map((e, i) => (
                    <li key={i}><Text type="supporting" color="secondary" className="text-xs">&ldquo;{e}&rdquo;</Text></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AiDetectionSection({ state }: { state: AiDetectionState }) {
  if (state.status === "loading") {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <Text color="secondary" className="text-xs">Checking the writing for AI authorship…</Text>
        </div>
      </div>
    );
  }
  if (!state.data) {
    return <Banner status="info" title="AI authorship check unavailable." className="mx-4 my-3" />;
  }
  return (
    <AiDetectionPanel
      ai={state.data}
      note={state.status === "error" ? "Showing an offline estimate — the AI check was unavailable." : undefined}
    />
  );
}

function AiDetectionPanel({ ai, note }: { ai: AiDetection; note?: string }) {
  const bandColor =
    ai.band === "high" ? "text-rose-500" : ai.band === "moderate" ? "text-amber-500" : "text-emerald-600";
  return (
    <div className="px-4 py-3 text-xs">
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold ${bandColor}`}>{ai.confidence}%</span>
        <div>
          <Text weight="semibold" display="block" className={`capitalize text-xs ${bandColor}`}>{ai.band} AI signal</Text>
          <Text color="secondary" display="block" className="text-xs">
            Probabilistic estimate of how AI-generated the resume reads.
          </Text>
        </div>
      </div>
      {note && <Text type="supporting" display="block" className="mt-1 text-amber-600 text-xs">{note}</Text>}
      <div className="mt-3 space-y-2">
        {ai.patterns.map((p) => (
          <div key={p.label}>
            <div className="flex items-center justify-between">
              <Text weight="semibold" className="text-xs">{p.label}</Text>
              <Text type="supporting" color="secondary" className="tabular-nums text-xs">{p.signal}</Text>
            </div>
            <ProgressBar value={p.signal} max={100} label={p.label} className="mt-0.5 h-1.5" />
            <Text type="supporting" color="secondary" display="block" className="mt-0.5 text-xs leading-snug">{p.message}</Text>
            {p.examples.length > 0 && (
              <Text type="supporting" color="secondary" display="block" className="mt-0.5 text-xs">e.g. {p.examples.join(", ")}</Text>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchReportView({
  report,
  aiDetection,
  onRunAnalysis,
  analysisDisabled,
  hasAnalysis,
  subTab: controlledSubTab,
  onSubTabChange,
  hideSegmentedControl,
}: MatchReportViewProps) {
  const [internalSubTab, setInternalSubTab] = useState<ReportSubTab>("match");
  const subTab = controlledSubTab ?? internalSubTab;
  const setSubTab = onSubTabChange ?? setInternalSubTab;

  return (
    <div>
      {!hideSegmentedControl && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <SegmentedControl value={subTab} onChange={(v) => setSubTab(v as ReportSubTab)} label="Report view">
            <SegmentedControlItem value="match" label={`ATS pass (${report.score}/100)`} />
            <SegmentedControlItem value="ai" label={aiDetection.data !== null && aiDetection.data !== undefined ? `AI slop (${aiDetection.data.confidence}%)` : "AI slop"} />
          </SegmentedControl>
          {onRunAnalysis && (
            <Button
              label={hasAnalysis ? "Re-run analysis" : "Run analysis"}
              variant="primary"
              size="sm"
              onClick={onRunAnalysis}
              isDisabled={analysisDisabled}
            />
          )}
        </div>
      )}

      {subTab === "match" && (
        <div className="space-y-3">
          <SummaryCards report={report} />

          <Section title="Searchability">
            <SearchabilityTable groups={report.searchability} />
          </Section>

          <Section title="Hard Skills">
            <SkillsTable section={report.hardSkills} title="Hard skills" />
          </Section>

          <Section title="Soft Skills">
            <SkillsTable section={report.softSkills} title="Soft skills" />
          </Section>

          <Section title="Recruiter Tips">
            <RecruiterTable tips={report.recruiterTips} />
          </Section>
        </div>
      )}

      {subTab === "ai" && (
        <Card className="overflow-hidden">
          <AiDetectionSection state={aiDetection} />
        </Card>
      )}
    </div>
  );
}

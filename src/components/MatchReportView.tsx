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
import { Heading } from "@astryxdesign/core/Heading";

import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";

/** Async state of the LLM-based AI-authorship check (owned by App). */
export interface AiDetectionState {
  status: "loading" | "done" | "error";
  /** LLM result when done; heuristic fallback on error; may be null while loading. */
  data: AiDetection | null;
}

type ReportSubTab = "match" | "ai";

interface MatchReportViewProps {
  report: MatchReport;
  aiDetection: AiDetectionState;
  onRunAnalysis?: () => void;
  analysisDisabled?: boolean;
  hasAnalysis?: boolean;
}

function SummaryCards({ report }: { report: MatchReport }) {
  const cards = [
    { label: "Hard Skills", n: report.counts.hardSkillsIssues },
    { label: "Soft Skills", n: report.counts.softSkillsIssues },
    { label: "Searchability", n: report.counts.searchabilityIssues },
    { label: "Recruiter Tips", n: report.counts.recruiterIssues },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ScoreRing score={report.score} />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="px-4 py-3">
            <Text type="supporting" color="secondary" display="block">{c.label}</Text>
            <div className="mt-1">
              <Text type="large" weight="semibold" color={c.n > 0 ? "primary" : undefined} className={c.n === 0 ? "text-emerald-600" : undefined}>
                {c.n}
              </Text>{" "}
              <Text type="supporting" color="secondary">{c.n === 1 ? "issue" : "issues"}</Text>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <Heading level={2} className="mb-3 tracking-tight">{title}</Heading>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

function SearchabilityTable({ groups }: { groups: SearchabilityGroup[] }) {
  return (
    <div className="divide-y divide-slate-100">
      {groups.map((g) => (
        <div key={g.label} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <Text type="label" weight="semibold" display="block">{g.label}</Text>
          <ul className="space-y-2">
            {g.items.map((item, i) => (
              <li key={i} className="flex gap-3 leading-relaxed">
                <StatusIcon status={item.status} />
                <Text color="secondary">{item.message}</Text>
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
    <div>
      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3">
        <Text type="label" weight="semibold">{title}</Text>
        <Text color="secondary">
          Matched <Text weight="semibold" className="text-emerald-600">{section.matched}</Text>
        </Text>
        <Text color="secondary">
          Missing <Text weight="semibold" className="text-rose-500">{section.missing}</Text>
        </Text>
      </div>
      {section.rows.length === 0 ? (
        <Text type="supporting" color="secondary" display="block" className="px-5 py-4">No skills of this type detected in the job description.</Text>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left uppercase tracking-wide">
              <th className="px-5 py-2"><Text type="supporting" color="secondary" weight="semibold">Skill</Text></th>
              <th className="px-5 py-2 text-right"><Text type="supporting" color="secondary" weight="semibold">Resume</Text></th>
              <th className="px-5 py-2 text-right"><Text type="supporting" color="secondary" weight="semibold">Job Description</Text></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {section.rows.map((row) => (
              <tr key={row.skill}>
                <td className="px-5 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <StatusIcon status={row.state === "missing" ? "fail" : "pass"} className="h-4 w-4" />
                    <Text>{row.skill}</Text>
                    {row.state === "exceeds" && (
                      <Badge variant="warning" label="over-indexed" />
                    )}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {row.state === "missing" ? <Text className="text-rose-400">✕</Text> : <Text>{row.resumeCount}</Text>}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums"><Text>{row.jobCount}</Text></td>
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
    <div className="divide-y divide-slate-100">
      {tips.map((t) => (
        <div key={t.label} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <Text type="label" weight="semibold" display="block">{t.label}</Text>
          <div className="space-y-2">
            <div className="flex gap-3 leading-relaxed">
              <StatusIcon status={t.status} />
              <Text color="secondary">{t.message}</Text>
            </div>
            {t.evidence && t.evidence.length > 0 && (
              <div className="ml-8 rounded-lg bg-slate-50 px-3 py-2">
                <Text type="supporting" weight="semibold" display="block" className="mb-1 uppercase tracking-wide">
                  Evidence
                </Text>
                <ul className="space-y-1 italic">
                  {t.evidence.map((e, i) => (
                    <li key={i}><Text type="supporting" color="secondary">&ldquo;{e}&rdquo;</Text></li>
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
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <Text color="secondary">Checking the writing for AI authorship…</Text>
        </div>
      </div>
    );
  }
  if (!state.data) {
    return <Banner status="info" title="AI authorship check unavailable." className="mx-5 my-4" />;
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
    <div className="px-5 py-4">
      <div className="flex items-center gap-3">
        <Heading level={2} className={bandColor}>{ai.confidence}%</Heading>
        <div>
          <Text weight="semibold" display="block" className={`capitalize ${bandColor}`}>{ai.band} AI signal</Text>
          <Text color="secondary" display="block">
            Probabilistic estimate of how AI-generated the resume reads — not a verdict.
          </Text>
        </div>
      </div>
      {note && <Text type="supporting" display="block" className="mt-2 text-amber-600">{note}</Text>}
      <div className="mt-4 space-y-3">
        {ai.patterns.map((p) => (
          <div key={p.label}>
            <div className="flex items-center justify-between">
              <Text weight="semibold">{p.label}</Text>
              <Text type="supporting" color="secondary" className="tabular-nums">{p.signal}</Text>
            </div>
            <ProgressBar value={p.signal} max={100} label={p.label} className="mt-1" />
            <Text type="supporting" color="secondary" display="block" className="mt-1 leading-relaxed">{p.message}</Text>
            {p.examples.length > 0 && (
              <Text type="supporting" color="secondary" display="block" className="mt-1">e.g. {p.examples.join(", ")}</Text>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchReportView({ report, aiDetection, onRunAnalysis, analysisDisabled, hasAnalysis }: MatchReportViewProps) {
  const [subTab, setSubTab] = useState<ReportSubTab>("match");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <SegmentedControl value={subTab} onChange={(v) => setSubTab(v as ReportSubTab)} label="Report view">
          <SegmentedControlItem value="match" label="Match" />
          <SegmentedControlItem value="ai" label="AI Detection" />
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

      {subTab === "match" && (
        <>
          <Heading level={1} className="mb-5">Match Report</Heading>

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
        </>
      )}

      {subTab === "ai" && (
        <>
          <Heading level={1} className="mb-5 tracking-tight">AI Authorship Detection</Heading>
          <Card className="overflow-hidden">
            <AiDetectionSection state={aiDetection} />
          </Card>
        </>
      )}
    </div>
  );
}

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
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="mt-1 text-sm">
              <span className={`text-xl font-semibold ${c.n > 0 ? "text-slate-800" : "text-emerald-600"}`}>
                {c.n}
              </span>{" "}
              <span className="text-slate-500">{c.n === 1 ? "issue" : "issues"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-slate-800">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>
    </section>
  );
}

function SearchabilityTable({ groups }: { groups: SearchabilityGroup[] }) {
  return (
    <div className="divide-y divide-slate-100">
      {groups.map((g) => (
        <div key={g.label} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <div className="text-sm font-semibold text-slate-700">{g.label}</div>
          <ul className="space-y-2">
            {g.items.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-600">
                <StatusIcon status={item.status} />
                <span>{item.message}</span>
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
      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3 text-sm">
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="text-slate-500">
          Matched <span className="font-semibold text-emerald-600">{section.matched}</span>
        </span>
        <span className="text-slate-500">
          Missing <span className="font-semibold text-rose-500">{section.missing}</span>
        </span>
      </div>
      {section.rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No skills of this type detected in the job description.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2 font-medium">Skill</th>
              <th className="px-5 py-2 text-right font-medium">Resume</th>
              <th className="px-5 py-2 text-right font-medium">Job Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {section.rows.map((row) => (
              <tr key={row.skill}>
                <td className="px-5 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <StatusIcon status={row.state === "missing" ? "fail" : "pass"} className="h-4 w-4" />
                    <span className="text-slate-700">{row.skill}</span>
                    {row.state === "exceeds" && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                        over-indexed
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">
                  {row.state === "missing" ? <span className="text-rose-400">✕</span> : row.resumeCount}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">{row.jobCount}</td>
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
          <div className="text-sm font-semibold text-slate-700">{t.label}</div>
          <div className="space-y-2">
            <div className="flex gap-3 text-sm leading-relaxed text-slate-600">
              <StatusIcon status={t.status} />
              <span>{t.message}</span>
            </div>
            {t.evidence && t.evidence.length > 0 && (
              <div className="ml-8 rounded-lg bg-slate-50 px-3 py-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Evidence
                </div>
                <ul className="space-y-1 text-xs italic text-slate-500">
                  {t.evidence.map((e, i) => (
                    <li key={i}>&ldquo;{e}&rdquo;</li>
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
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
          Checking the writing for AI authorship…
        </div>
      </div>
    );
  }
  if (!state.data) {
    return <p className="px-5 py-4 text-sm text-slate-400">AI authorship check unavailable.</p>;
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
        <div className="text-3xl font-semibold text-slate-800">{ai.confidence}%</div>
        <div className="text-sm">
          <div className={`font-semibold capitalize ${bandColor}`}>{ai.band} AI signal</div>
          <div className="text-slate-500">
            Probabilistic estimate of how AI-generated the resume reads — not a verdict.
          </div>
        </div>
      </div>
      {note && <p className="mt-2 text-xs text-amber-600">{note}</p>}
      <div className="mt-4 space-y-3">
        {ai.patterns.map((p) => (
          <div key={p.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{p.label}</span>
              <span className="tabular-nums text-slate-400">{p.signal}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${p.signal >= 66 ? "bg-rose-400" : p.signal >= 33 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${p.signal}%` }}
              />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.message}</p>
            {p.examples.length > 0 && (
              <p className="mt-1 text-xs text-slate-400">e.g. {p.examples.join(", ")}</p>
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
        <div className="inline-flex rounded-full bg-slate-100 p-1">
          {(["match", "ai"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                subTab === key ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {key === "match" ? "Match" : "AI Detection"}
            </button>
          ))}
        </div>
        {onRunAnalysis && (
          <button
            onClick={onRunAnalysis}
            disabled={analysisDisabled}
            className="shrink-0 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {hasAnalysis ? "Re-run analysis" : "Run analysis"}
          </button>
        )}
      </div>

      {subTab === "match" && (
        <>
          {report.meta.jobTitle && (
            report.meta.jobUrl ? (
              <a href={report.meta.jobUrl} target="_blank" rel="noopener noreferrer" className="mb-1 block text-sm text-brand hover:underline">
                {report.meta.jobTitle} ↗
              </a>
            ) : (
              <div className="mb-1 text-sm text-slate-500">{report.meta.jobTitle}</div>
            )
          )}
          <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-900">Match Report</h1>

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
          <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-900">AI Authorship Detection</h1>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <AiDetectionSection state={aiDetection} />
          </div>
        </>
      )}
    </div>
  );
}

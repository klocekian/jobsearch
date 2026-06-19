// Orchestrator: runs all four analysis modules and assembles a MatchReport,
// including the overall 0-100 match score.

import type { AnalyzeInput, MatchReport, SearchabilityGroup, RecruiterTip } from "./types";
import { analyzeSearchability } from "./searchability";
import { analyzeSkills } from "./skills";
import { analyzeRecruiter } from "./recruiter";
import { detectAiAuthorship } from "./ai-detection";

function countFails(groups: SearchabilityGroup[]): number {
  return groups.reduce(
    (n, g) => n + g.items.filter((i) => i.status !== "pass").length,
    0
  );
}

function countTipIssues(tips: RecruiterTip[]): number {
  return tips.filter((t) => t.status !== "pass").length;
}

/**
 * Weighted score. Skill match dominates (the spec's primary signal), then
 * searchability, then recruiter tips. AI detection is reported but does not
 * lower the match score — it is advisory, not a gate.
 */
function computeScore(report: Omit<MatchReport, "score">): number {
  const hardTotal = report.hardSkills.rows.length || 1;
  const hardMatched = report.hardSkills.matched;
  const softTotal = report.softSkills.rows.length || 1;
  const softMatched = report.softSkills.matched;

  const skillScore = (hardMatched / hardTotal) * 0.6 + (softMatched / softTotal) * 0.4;

  const searchTotal = report.searchability.reduce((n, g) => n + g.items.length, 0) || 1;
  const searchPass = report.searchability.reduce(
    (n, g) => n + g.items.filter((i) => i.status === "pass").length,
    0
  );
  const searchScore = searchPass / searchTotal;

  const tipTotal = report.recruiterTips.length || 1;
  const tipPass = report.recruiterTips.filter((t) => t.status === "pass").length;
  const tipScore = tipPass / tipTotal;

  const raw = skillScore * 0.55 + searchScore * 0.3 + tipScore * 0.15;
  return Math.round(raw * 100);
}

export function analyze(input: AnalyzeInput): MatchReport {
  const searchability = analyzeSearchability(input);
  const { hardSkills, softSkills, matchedTerms, missingTerms } = analyzeSkills(
    input.resumeText,
    input.jobText
  );
  const recruiterTips = analyzeRecruiter(input);
  const aiDetection = detectAiAuthorship(input.resumeText);

  const partial: Omit<MatchReport, "score"> = {
    meta: {
      company: input.company,
      jobTitle: input.jobTitle,
      jobUrl: input.jobUrl,
      fileName: input.fileName,
    },
    counts: {
      hardSkillsIssues: hardSkills.missing,
      softSkillsIssues: softSkills.missing,
      searchabilityIssues: countFails(searchability),
      recruiterIssues: countTipIssues(recruiterTips),
    },
    searchability,
    hardSkills,
    softSkills,
    recruiterTips,
    aiDetection,
    highlights: { matched: matchedTerms, missing: missingTerms },
  };

  return { ...partial, score: computeScore(partial) };
}

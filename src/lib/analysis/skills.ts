// Module 2: Keyword & Skills Matching.
// Extracts skills from the job description using the curated taxonomy + synonym
// map, then reports resume vs. job-description counts and classifies each as
// matched / missing / exceeds (over-indexed).

import type { SkillRow, SkillSection } from "./types";
import { SKILL_TAXONOMY, type SkillDef } from "./taxonomy";

// Common inflectional endings, longest-first so the regex prefers the longest
// match. A trailing silent "e" is dropped from the stem (advocate -> advocat)
// and restored via the "e" branch, so "advocate/advocates/advocated/advocating"
// all match a single "advocate" variant.
const INFLECTIONS = "ings|ing|ions|ion|ers|er|ed|es|e|s|d";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Regex source for one variant. Single whole words become tense/plural tolerant
 * (so a different verb tense isn't a false "missing"); multi-word or hyphenated
 * variants stay exact to avoid spurious matches.
 */
function variantPattern(v: string): string {
  if (!/^[a-z]+$/i.test(v)) return esc(v);
  const stem = v.replace(/e$/i, "");
  return `${esc(stem)}(?:${INFLECTIONS})?`;
}

/**
 * Occurrences of a skill in the text. Variants are combined into a single
 * longest-first alternation so overlapping forms are counted once — e.g.
 * "user research" is one hit, not also a separate "research" hit, and "ai"
 * inside "ai-native" is not double-counted. Whole-word variants also match
 * common inflections (advocate -> advocated, mentor -> mentored).
 */
function skillCount(text: string, def: SkillDef): number {
  const alternation = [...def.variants]
    .sort((a, b) => b.length - a.length)
    .map(variantPattern)
    .join("|");
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${alternation})(?![A-Za-z0-9])`, "gi");
  return (text.match(re) ?? []).length;
}

function buildRows(
  defs: SkillDef[],
  resumeText: string,
  jobText: string
): SkillRow[] {
  const rows: SkillRow[] = [];
  for (const def of defs) {
    const jobCount = skillCount(jobText, def);
    if (jobCount === 0) continue; // Only skills the job actually asks for.
    const resumeCount = skillCount(resumeText, def);

    let state: SkillRow["state"];
    if (resumeCount === 0) state = "missing";
    else if (resumeCount >= jobCount * 2 && resumeCount >= 4) state = "exceeds";
    else state = "matched";

    rows.push({ skill: def.name, resumeCount, jobCount, state });
  }

  // Sort: matched/exceeds first (by job weight desc), then missing.
  return rows.sort((a, b) => {
    const am = a.state === "missing" ? 1 : 0;
    const bm = b.state === "missing" ? 1 : 0;
    if (am !== bm) return am - bm;
    return b.jobCount - a.jobCount;
  });
}

function toSection(rows: SkillRow[]): SkillSection {
  return {
    matched: rows.filter((r) => r.state !== "missing").length,
    missing: rows.filter((r) => r.state === "missing").length,
    rows,
  };
}

export function analyzeSkills(
  resumeText: string,
  jobText: string
): { hardSkills: SkillSection; softSkills: SkillSection; matchedTerms: string[]; missingTerms: string[] } {
  const hardRows = buildRows(SKILL_TAXONOMY.filter((d) => d.kind === "hard"), resumeText, jobText);
  const softRows = buildRows(SKILL_TAXONOMY.filter((d) => d.kind === "soft"), resumeText, jobText);

  const all = [...hardRows, ...softRows];
  const matchedTerms = all.filter((r) => r.state !== "missing").map((r) => r.skill);
  const missingTerms = all.filter((r) => r.state === "missing").map((r) => r.skill);

  return {
    hardSkills: toSection(hardRows),
    softSkills: toSection(softRows),
    matchedTerms,
    missingTerms,
  };
}

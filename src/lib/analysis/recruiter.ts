// Module 3: Recruiter Signal Analysis.
// Evaluates the signals a human reviewer uses once a resume passes ATS:
// job-level alignment, measurable results, tone, web presence, word count.

import type { AnalyzeInput, RecruiterTip } from "./types";
import { sentences, wordCount, URL_RE, isStructuredLine } from "./text";

const CLICHES = [
  "results-driven", "results driven", "team player", "go-getter", "go getter",
  "hard worker", "self-starter", "self starter", "detail-oriented", "detail oriented",
  "think outside the box", "synergy", "best of breed", "value-add", "hit the ground running",
];

const METRIC_RE = /(\$\s?\d[\d,.]*\s?(k|m|b|million|billion)?|\d[\d,.]*\s?%|\b\d{2,}[\d,.]*\b|\bteam of \d+|\d+x\b)/gi;

// Years-of-experience extracted from the job description vs. demonstrated in the resume.
function requiredYears(jobText: string): number | null {
  const m = jobText.match(/(\d{1,2})\+?\s*years?/i);
  return m ? parseInt(m[1], 10) : null;
}

function resumeYears(resumeText: string): number {
  // Span between earliest and latest 4-digit year mentioned.
  const years = [...resumeText.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => parseInt(m[0], 10));
  if (years.length < 2) return years.length;
  const now = new Date().getFullYear();
  const min = Math.min(...years);
  return Math.max(0, Math.min(now, Math.max(...years)) - min);
}

export function analyzeRecruiter(input: AnalyzeInput): RecruiterTip[] {
  const { resumeText, jobText } = input;
  const tips: RecruiterTip[] = [];

  // Job level alignment.
  const reqYears = requiredYears(jobText);
  const haveYears = resumeYears(resumeText);
  if (reqYears == null) {
    tips.push({ label: "Job Level Match", status: "pass", message: "The job description does not state a specific years-of-experience requirement. Review the seniority signals manually before applying." });
  } else if (haveYears >= reqYears - 2) {
    tips.push({ label: "Job Level Match", status: "pass", message: "Your years of experience align with the role's requirements. This is a positive start, but remember to carefully review all other job criteria to ensure you're a strong overall match before applying." });
  } else {
    tips.push({ label: "Job Level Match", status: "warning", message: `The role implies about ${reqYears} years of experience; your resume demonstrates roughly ${haveYears}. Underclaiming experience can filter you out of tenure-based searches.` });
  }

  // Measurable results. Skip contact/header lines (a phone number's digits would
  // otherwise be counted as a metric and quoted as "evidence").
  const contentSentences = sentences(resumeText).filter((s) => !isStructuredLine(s));
  const metricCounts = contentSentences.map((s) => [...s.matchAll(METRIC_RE)].length);
  const metricTotal = metricCounts.reduce((n, c) => n + c, 0);
  const metricSentences = contentSentences.filter((_, i) => metricCounts[i] > 0).slice(0, 4);
  if (metricTotal >= 5) {
    tips.push({ label: "Measurable Results", status: "pass", message: "There are five or more mentions of measurable results in your resume. Keep it up - employers like to see the impact and results that you had on the job.", evidence: metricSentences });
  } else {
    tips.push({ label: "Measurable Results", status: "fail", message: `Only ${metricTotal} measurable results found. Aim for five or more quantified outcomes (percentages, dollars, headcount, timelines).`, evidence: metricSentences });
  }

  // Resume tone.
  const found = CLICHES.filter((c) => new RegExp(`\\b${c.replace(/[-]/g, "[- ]")}\\b`, "i").test(resumeText));
  const passive = (resumeText.match(/\b(was|were|been|being)\s+\w+ed\b/gi) ?? []).length;
  if (found.length === 0 && passive < 4) {
    tips.push({ label: "Resume Tone", status: "pass", message: "The tone of your resume is generally positive and no common cliches and buzzwords were found. Good job!" });
  } else {
    tips.push({
      label: "Resume Tone",
      status: "warning",
      message: `We flagged ${found.length} cliche${found.length === 1 ? "" : "s"} and ${passive} passive construction${passive === 1 ? "" : "s"}. Replace them with active, specific language.`,
      evidence: found,
    });
  }

  // Web presence.
  tips.push(
    URL_RE.test(resumeText)
      ? { label: "Web Presence", status: "pass", message: "Nice - You've linked to a website that builds your web credibility. Recruiters appreciate the convenience and credibility associated with a professional website." }
      : { label: "Web Presence", status: "warning", message: "No personal site, portfolio, or LinkedIn URL found. A verifiable link adds credibility for reviewers." }
  );

  // Word count.
  const wc = wordCount(resumeText);
  const isExec = /\b(director|vp|vice president|chief|head of|executive|c-level)\b/i.test(input.jobTitle);
  const ceiling = isExec ? 1400 : 1000;
  tips.push(
    wc <= ceiling
      ? { label: "Word Count", status: "pass", message: `Your resume is ${wc} words, within the recommended length for this role.` }
      : { label: "Word Count", status: "fail", message: `There are ${wc} words in your resume. If you are not applying to executive-level, government, or Australia-based jobs, consider reducing your resume length to under ${ceiling} words to increase focus and for ease of reading by recruiters.` }
  );

  return tips;
}

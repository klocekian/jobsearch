// Module 4: AI Authorship Detection.
// Heuristic signals only — detection is probabilistic, so the output is a
// confidence band with explanations, never a binary verdict. The signals favor
// genuine LLM stylistic tells (antithesis, AI buzzwords, prose em-dashes) plus
// two structural signals, and deliberately avoid penalizing normal résumé
// conventions (round metrics, strong verbs, parallel bullets).

import type { AiDetection, AiPattern } from "./types";
import { bulletLines, sentences, words } from "./text";

function variance(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
}

// Negative parallelism / antithesis — the classic LLM cadence.
const ANTITHESIS_RES: RegExp[] = [
  /\bit'?s not\b[^.?!\n]{1,80}?\bit'?s\b/gi, // "it's not X, it's Y"
  /\bnot just\b[^.?!\n]{1,80}?\bbut\b/gi, // "not just X, but Y"
  /\bnot only\b[^.?!\n]{1,80}?\bbut\b/gi, // "not only X but (also) Y"
  /\b(?:isn'?t|aren'?t|wasn'?t)\b[^.?!\n]{1,80}?\bit'?s\b/gi, // "isn't about X, it's Y"
  /\bnot (?:about|merely|simply)\b[^.?!\n]{1,80}?\b(?:but|it'?s)\b/gi,
];

// AI-tell vocabulary and stock openers (curated from common LLM output).
const AI_PHRASES = [
  "delve", "leverage", "leveraging", "tapestry", "testament to", "underscore",
  "pivotal", "realm", "resonate", "seamless", "seamlessly", "robust", "holistic",
  "myriad", "plethora", "elevate", "unlock", "navigate the landscape",
  "in today's", "ever-evolving", "ever-changing", "fast-paced", "cutting-edge",
  "game-changer", "game-changing", "best-in-class", "at the intersection of",
  "what excites me most", "i'm thrilled", "i'm excited to", "passionate about",
  "deeply committed", "wide range of", "meticulous", "meticulously",
];

export function detectAiAuthorship(resumeText: string): AiDetection {
  const patterns: AiPattern[] = [];
  const prose = bulletLines(resumeText); // prose lines, contact/headers excluded
  const sents = sentences(resumeText);

  // 1. Antithesis / negative parallelism ("it's not X, it's Y").
  const antithesisHits: string[] = [];
  for (const re of ANTITHESIS_RES) {
    for (const m of resumeText.matchAll(re)) antithesisHits.push(m[0].replace(/\s+/g, " ").trim());
  }
  const antithesisSignal = Math.min(100, antithesisHits.length * 45);
  patterns.push({
    label: "Antithesis / negative parallelism",
    signal: antithesisSignal,
    message:
      'The "it\'s not X, it\'s Y" / "not just X, but Y" construction is one of the strongest LLM cadence tells; humans use it far less.',
    examples: [...new Set(antithesisHits)].slice(0, 4),
  });

  // 2. AI buzzwords and stock openers.
  const phraseAlt = AI_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const phraseRe = new RegExp(`(?<![A-Za-z])(?:${phraseAlt})(?![A-Za-z])`, "gi");
  const phraseHits = [...resumeText.matchAll(phraseRe)].map((m) => m[0].toLowerCase());
  const phraseSignal = Math.min(100, phraseHits.length * 18);
  patterns.push({
    label: "AI buzzwords & stock phrasing",
    signal: phraseSignal,
    message:
      "Words like delve, leverage, seamless, robust, and openers like \"in today's…\" / \"at the intersection of…\" are disproportionately common in AI text.",
    examples: [...new Set(phraseHits)].slice(0, 6),
  });

  // 3. Em-dashes in prose. Counted only in bullet/summary lines (which never
  // contain the "·" résumé header separator), so legitimate "Role — Company" and
  // "2023 – Present" formatting is not mistaken for a tell.
  const proseEmDashes = prose
    .filter((l) => !l.includes("·"))
    .reduce((n, l) => n + (l.match(/—/g)?.length ?? 0), 0);
  const emDashSignal = Math.min(100, proseEmDashes * 22);
  const emExample = prose.find((l) => !l.includes("·") && l.includes("—"));
  patterns.push({
    label: "Em-dashes in prose",
    signal: emDashSignal,
    message:
      "Frequent em-dashes (—) used mid-sentence are a hallmark of AI writing; most people rarely type them. (Dashes in dated headers are ignored.)",
    examples: emExample ? [emExample.slice(0, 120)] : [],
  });

  // 4. Lexical uniformity — consistent sentence length across the document.
  const lengths = sents.map((s) => words(s).length).filter((n) => n > 2);
  const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const cv = mean ? Math.sqrt(variance(lengths)) / mean : 1; // coefficient of variation
  const uniformitySignal = Math.max(0, Math.min(100, Math.round((0.55 - cv) * 200)));
  patterns.push({
    label: "Lexical uniformity",
    signal: uniformitySignal,
    message:
      "Human-written résumés vary sentence length and complexity across roles written at different times. Unusually uniform structure reads as machine-generated.",
    examples: [],
  });

  // 5. Specificity deficit — absence of proper nouns / grounded detail.
  const properNouns = [...resumeText.matchAll(/\b[A-Z][a-zA-Z]+\b/g)].length;
  const totalWords = words(resumeText).length || 1;
  const properRatio = properNouns / totalWords;
  const specificitySignal = Math.max(0, Math.min(100, Math.round((0.08 - properRatio) * 1000)));
  patterns.push({
    label: "Specificity deficit",
    signal: specificitySignal,
    message:
      "Absence of specific product names, team names, and tools — detail that requires genuine recall — suggests categorical, AI-style abstraction.",
    examples: [],
  });

  // Aggregate: weighted average, leaning on the stylistic tells.
  const weights = [1.4, 1.1, 1.1, 1, 0.9];
  const weighted =
    patterns.reduce((sum, p, i) => sum + p.signal * weights[i], 0) /
    weights.reduce((a, b) => a + b, 0);
  const confidence = Math.round(weighted);
  const band = confidence >= 66 ? "high" : confidence >= 33 ? "moderate" : "low";

  return { confidence, band, patterns: patterns.sort((a, b) => b.signal - a.signal) };
}

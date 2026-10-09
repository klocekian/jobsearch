import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { AI_TELL_OPENERS, AI_TELL_WORDS } from "./ai-tells";

// AI-authorship detection by the model itself — more reliable than surface
// heuristics. Returns a calibrated confidence plus the specific LLM stylistic
// tells found, each with verbatim evidence. The client falls back to the local
// heuristic (lib/analysis/ai-detection.ts) when this is unavailable.

const PatternSchema = z.object({
  label: z.string(),
  /** 0-100: how strongly this tell is present. */
  signal: z.number(),
  message: z.string(),
  /** Verbatim quotes from the resume that show the tell. */
  examples: z.array(z.string()),
});

const ResultSchema = z.object({
  /** 0-100 overall likelihood the text was written/heavily edited by an LLM. */
  confidence: z.number(),
  patterns: z.array(PatternSchema),
});

const SYSTEM = [
  "You are an expert at detecting AI-generated or AI-heavily-edited prose. Judge how much a resume reads as written by a large language model.",
  "Look for genuine LLM stylistic signatures, and quote verbatim evidence for each you find:",
  "- Antithesis / negative parallelism: \"it's not X, it's Y\", \"not just X, but Y\", \"not only... but also\".",
  "- Em-dashes (—) used as prose punctuation mid-sentence (NOT dashes in dated headers like 'Director — Company' or date ranges like '2018 – 2023').",
  `- AI buzzwords/filler: ${AI_TELL_WORDS.join(", ")}; stock openers like ${AI_TELL_OPENERS.slice(0, 2).map((o) => `"${o}"`).join(", ")}.`,
  "- Rule-of-three triads used for rhythm; uniformly smooth sentence rhythm; vague, generic phrasing that lacks concrete, specific detail.",
  "CALIBRATION — this matters: a normal, well-written human resume is NOT AI. Do NOT treat round numbers, strong action verbs (led, drove, built), quantified metrics, or parallel bullet structure as AI signals — those are standard, good resume writing. Only flag true LLM stylistic tells. If there is little real evidence, return a low confidence and few or no patterns.",
  "For each tell actually present, return one pattern: label (short), signal 0-100 (strength), message (one-sentence explanation), examples (verbatim quotes from the resume, up to 5; never invent text).",
  "Return an overall confidence 0-100 reflecting how AI-authored the writing reads.",
].join("\n");

export interface AuthorshipAssessment {
  confidence: number;
  band: "low" | "moderate" | "high";
  patterns: z.infer<typeof PatternSchema>[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function assessAIAuthorship(userId: number, resumeText: string): Promise<AuthorshipAssessment> {
  const { data } = await generateStructured(userId, {
    system: SYSTEM,
    prompt: `=== RESUME ===\n${resumeText}\n\nAssess AI authorship now.`,
    schema: ResultSchema,
    schemaName: "AIDetectionResult",
    maxTokens: 4000,
  });
  const confidence = clamp(data.confidence);
  return {
    confidence,
    band: confidence >= 66 ? "high" : confidence >= 33 ? "moderate" : "low",
    patterns: data.patterns.map((p) => ({ ...p, signal: clamp(p.signal), examples: p.examples.slice(0, 5) })),
  };
}

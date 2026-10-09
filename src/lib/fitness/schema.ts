import { z } from "zod";

/**
 * Structured result of a fitness check.
 *
 * Ported from the `fitness_result` tool schema in fitness_check.py. The enums
 * are load-bearing: MEET/ADJACENT/MISS is the taxonomy that replaced the old
 * binary gate check, and constraining the model to it is what stops "sort of
 * meets" from appearing as a verdict.
 */

export const VerdictPerRequirement = z.enum(["MEET", "ADJACENT", "MISS"]);

export const RequirementSchema = z.object({
  verbatim: z.string().describe("Copied word for word from the posting.").default(""),
  kind: z.enum(["objective", "dispositional"]).catch("objective").default("objective"),
  verdict: VerdictPerRequirement.catch("MISS").default("MISS"),
  note: z.string().describe("One short line citing the profile fact, adjacency, or absence.").default(""),
});

export const PreferredSchema = z.object({
  verbatim: z.string().default(""),
  verdict: VerdictPerRequirement.catch("MISS").default("MISS"),
});

export const GapSchema = z.object({
  gap: z.string().describe("The gap, plainly stated.").default(""),
  framing: z
    .string()
    .describe("The mindful prepared response, from a standing reframe or built fresh. Never an embellishment.")
    .default(""),
});

export const FitnessResultSchema = z.object({
  company: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default("Not specified"),
  work_arrangement: z
    .string()
    .describe("Remote, hybrid, onsite, days per week if stated, unknown if not.")
    .default("Not specified"),
  travel_percent: z.string().describe("As stated, or 'not stated'.").default("not stated"),
  salary: z.string().default("Not stated"),
  hard_stop: z.object({
    triggered: z.boolean().default(false),
    reason: z.string().describe("Verbatim requirement that triggers it, or empty.").default(""),
  }).default({ triggered: false, reason: "" }),
  employer_type: z
    .enum(["in_house", "vendor", "consultancy", "unknown"])
    .describe("Who posted this. Informs the score modestly; never a verdict.")
    .catch("unknown")
    .default("unknown"),
  employer_type_note: z
    .string()
    .describe("One line: what the type and title convention predict about this posting's requirements.")
    .default(""),
  logistics_note: z
    .string()
    .describe("One or two lines: corridor status, arrangement, negotiation potential. Light touch.")
    .default(""),
  stated_minimums: z
    .array(RequirementSchema)
    .describe("Only requirements from a required/minimum section. Empty if none stated.")
    .default([]),
  preferred: z
    .array(PreferredSchema)
    .describe("Preferred items. Inform score modestly, never decisively.")
    .default([]),
  score: z.coerce.number().min(1).max(10).default(5),
  band: z
    .enum(["long-shot practice", "practice", "target", "priority target"])
    .catch("practice")
    .default("practice"),
  verdict: z.enum(["APPLY", "DO_NOT_PURSUE"]).catch("APPLY").default("APPLY"),
  one_line: z
    .string()
    .describe("The score rationale in one sentence. If DO_NOT_PURSUE, name the hard stop.")
    .default(""),
  gaps: z
    .array(GapSchema)
    .describe("One entry per ADJACENT or notable MISS. Empty only if everything is MEET.")
    .default([]),
  outcomes: z.object({
    best_case: z.string().default(""),
    worst_case: z.string().default(""),
    probable: z.string().default(""),
  }).default({ best_case: "", worst_case: "", probable: "" }),
  tradeoffs: z.object({
    gained: z.string().describe("What pursuing this buys.").default(""),
    lost: z.string().describe("What pursuing this costs.").default(""),
  }).default({ gained: "", lost: "" }),
});

export type FitnessResult = z.infer<typeof FitnessResultSchema>;
export type FitnessRequirement = z.infer<typeof RequirementSchema>;
export type FitnessPreferred = z.infer<typeof PreferredSchema>;
export type FitnessGap = z.infer<typeof GapSchema>;

/** Bands, in score order, with the prep depth each implies. */
export const BAND_ORDER = [
  "long-shot practice",
  "practice",
  "target",
  "priority target",
] as const;

/**
 * Both bands mean apply — the band sets prep depth, not whether he applies.
 * Colors are deliberately distinct from the ATS score's palette so the two
 * numbers never read as the same kind of thing.
 */
export const BAND_VARIANTS: Record<string, "neutral" | "warning" | "blue" | "success"> = {
  "long-shot practice": "neutral",
  practice: "warning",
  target: "blue",
  "priority target": "success",
};

export function bandForScore(score: number): FitnessResult["band"] {
  if (score <= 3) return "long-shot practice";
  if (score <= 5) return "practice";
  if (score <= 7) return "target";
  return "priority target";
}

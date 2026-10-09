import { z } from "zod";
import { streamText } from "@/lib/ai";
import { AI_TELL_OPENERS, AI_TELL_WORDS } from "./ai-tells";

// Full-resume tailored rewrite, returned as PLAIN TEXT (not structured JSON) so
// the client can diff it against the original and re-parse it for PDF export.
// Grounded strictly in the resume + context materials; closes job keyword gaps
// only where real experience supports them; never fabricates.

export const RewriteInputSchema = z.object({
  resumeText: z.string().min(1).max(60_000),
  jobText: z.string().min(1).max(40_000),
  company: z.string().max(200).default(""),
  jobTitle: z.string().max(200).default(""),
  context: z.string().max(40_000).default(""),
  missingSkills: z.array(z.string().max(80)).max(50).default([]),
  /** AI-authorship tells found by the detector, so the rewrite targets them. */
  aiTells: z
    .array(z.object({ label: z.string().max(120), examples: z.array(z.string().max(400)).max(6) }))
    .max(12)
    .default([]),
});

export type RewriteInput = z.infer<typeof RewriteInputSchema>;

const SYSTEM = [
  "You are an expert resume editor. Rewrite the candidate's resume so it is tailored to the target job, while keeping it truthful and in their voice.",
  "GROUNDING: Use only what the resume and the candidate's context materials support. Never invent employers, titles, dates, metrics, skills, or experience. If the candidate lacks something the job wants, leave it out — do not fabricate it.",
  "CLOSE KEYWORD GAPS where the experience genuinely supports it: when real work is described in different words than the posting, rewrite it to use the posting's terminology (e.g. 'guided product iteration' -> name the roadmap work if that's what it was). This is relabeling real work, not inventing it. Do not keyword-stuff and do not add a list of unsupported skills.",
  "PRESERVE STRUCTURE: keep the same overall structure and section order as the original (name/header, summary, experience with roles and bullets, education, skills). Keep section headings as plain words on their own line (e.g. 'SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS'). Keep each role's company, title, and dates. Do not drop real experience.",
  "BE SURGICAL — this is critical. Make the MINIMUM changes needed. Reproduce the candidate's original wording verbatim wherever it already works, and only change a span of text when there is a concrete reason: to weave in a relevant keyword the experience genuinely supports, to sharpen a vague outcome, to fix a real weakness, or to remove an AI-writing tell (see below). Do NOT reword lines that are already fine, and do NOT restyle the whole resume.",
  "PRIORITY: when AI-authorship tells are listed below, you MUST rewrite each of those exact passages so the tell is gone, even if that means editing several lines — this is a targeted fix of flagged spans, not a free restyle. Keep every fact, number, name, and date intact.",
  "Preserve the candidate's exact wording, names, numbers, and dates unless a change is specifically justified by the rules above.",
  "WRITE LIKE A HUMAN — REMOVE AI TELLS. The result must not read as AI-generated, and you should fix any such tells already present in the source:",
  "- No antithesis / negative parallelism: avoid \"it's not X, it's Y\", \"not just X but Y\", \"not only ... but also\", and the \"X rather than Y\" contrast pattern (especially when repeated across bullets).",
  "- No literary/thesis-style summary openers; write a plain, direct professional summary.",
  "- Avoid rule-of-three triads used only for rhythm (rephrase or trim the list).",
  "- No em-dashes or en-dashes as punctuation inside a sentence or bullet; use commas, periods, colons, or parentheses. You MAY keep the original's dashes only where they are separators in role/date headers (e.g. 'Director — Company', '2018 – 2023').",
  `- Avoid AI buzzwords and filler: ${AI_TELL_WORDS.join(", ")}.`,
  `- No stock openers or hype: ${AI_TELL_OPENERS.map((o) => `"${o}"`).join(", ")}.`,
  "- Vary sentence structure and write plainly, concretely, and specifically.",
  "OUTPUT: return ONLY the full rewritten resume as plain text. No preamble, no commentary, no markdown code fences, no explanations.",
].join("\n");

function buildPrompt({ company, jobTitle, jobText, resumeText, context, missingSkills, aiTells }: RewriteInput): string {
  const tellsBlock =
    aiTells.length > 0
      ? "=== AI-AUTHORSHIP TELLS DETECTED (rewrite each of these passages so the tell is gone, keeping all facts) ===\n" +
        aiTells
          .map((t) => `- ${t.label}${t.examples.length ? `: ${t.examples.map((e) => `"${e}"`).join("; ")}` : ""}`)
          .join("\n")
      : "(No AI-authorship tells were flagged; just avoid introducing any.)";
  return [
    `Target role: ${jobTitle || "(see posting)"}${company ? ` at ${company}` : ""}`,
    "",
    "=== JOB POSTING ===",
    jobText,
    "",
    "=== CANDIDATE RESUME (rewrite this) ===",
    resumeText,
    "",
    context.trim()
      ? `=== CANDIDATE CONTEXT MATERIALS (real, may surface relevant experience) ===\n${context.trim()}`
      : "(No additional context materials provided.)",
    "",
    missingSkills.length > 0
      ? `=== JOB KEYWORDS MISSING FROM THE RESUME ===\n${missingSkills.join(", ")}\nIncorporate each ONLY where real experience supports it; skip any that aren't genuinely supported.`
      : "(Identify keyword gaps from the posting yourself.)",
    "",
    tellsBlock,
    "",
    "Return the full rewritten resume as plain text now.",
  ].join("\n");
}

export async function streamResumeRewrite(userId: number, input: RewriteInput): Promise<ReadableStream<Uint8Array>> {
  const { stream } = await streamText(userId, { system: SYSTEM, prompt: buildPrompt(input), maxTokens: 4096 });
  return stream;
}

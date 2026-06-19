import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Full-resume tailored rewrite. Returns the rewritten resume as PLAIN TEXT (a
// normal message, not structured JSON) so the client can diff it against the
// original and re-parse it for PDF export. Grounded strictly in the resume +
// context materials; closes job keyword gaps only where real experience supports
// them; never fabricates.

export const runtime = "nodejs";

const RequestSchema = z.object({
  resumeText: z.string().min(1).max(60_000),
  jobText: z.string().min(1).max(40_000),
  company: z.string().max(200).default(""),
  jobTitle: z.string().max(200).default(""),
  context: z.string().max(40_000).default(""),
  missingSkills: z.array(z.string().max(80)).max(50).default([]),
});

function buildSystemPrompt(): string {
  return [
    "You are an expert resume editor. Rewrite the candidate's resume so it is tailored to the target job, while keeping it truthful and in their voice.",
    "GROUNDING: Use only what the resume and the candidate's context materials support. Never invent employers, titles, dates, metrics, skills, or experience. If the candidate lacks something the job wants, leave it out — do not fabricate it.",
    "CLOSE KEYWORD GAPS where the experience genuinely supports it: when real work is described in different words than the posting, rewrite it to use the posting's terminology (e.g. 'guided product iteration' -> name the roadmap work if that's what it was). This is relabeling real work, not inventing it. Do not keyword-stuff and do not add a list of unsupported skills.",
    "PRESERVE STRUCTURE: keep the same overall structure and section order as the original (name/header, summary, experience with roles and bullets, education, skills). Keep section headings as plain words on their own line (e.g. 'SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS'). Keep each role's company, title, and dates. Do not drop real experience.",
    "BE SURGICAL — this is critical. Make the MINIMUM changes needed. Reproduce the candidate's original wording verbatim wherever it already works, and only change a span of text when there is a concrete reason: to weave in a relevant keyword the experience genuinely supports, to sharpen a vague outcome, to fix a real weakness, or to remove an AI-writing tell (see below). Do NOT reword lines that are already fine, and do NOT restyle the whole resume. The output should read as a lightly, precisely edited copy of the original — most lines unchanged — so a word-level diff highlights only a handful of targeted edits.",
    "Preserve the candidate's exact wording, names, numbers, and dates unless a change is specifically justified by the rules above.",
    "WRITE LIKE A HUMAN — REMOVE AI TELLS. The result must not read as AI-generated, and you should fix any such tells already present in the source:",
    "- No antithesis / negative parallelism: avoid \"it's not X, it's Y\", \"not just X but Y\", \"not only ... but also\".",
    "- No em-dashes or en-dashes as punctuation inside a sentence or bullet; use commas, periods, colons, or parentheses. You MAY keep the original's dashes only where they are separators in role/date headers (e.g. 'Director — Company', '2018 – 2023').",
    "- Avoid AI buzzwords and filler: delve, leverage, seamless, robust, holistic, tapestry, testament, underscore, pivotal, realm, resonate, myriad, elevate, unlock, cutting-edge, game-changing, best-in-class, synergy.",
    "- No stock openers or hype: \"In today's...\", \"At the intersection of...\", \"ever-evolving\", \"fast-paced\", \"passionate about\".",
    "- Avoid rule-of-three triads used only for rhythm. Vary sentence structure and write plainly, concretely, and specifically.",
    "OUTPUT: return ONLY the full rewritten resume as plain text. No preamble, no commentary, no markdown code fences, no explanations.",
  ].join("\n");
}

function buildUserPrompt(input: z.infer<typeof RequestSchema>): string {
  const { company, jobTitle, jobText, resumeText, context, missingSkills } = input;
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
    "Return the full rewritten resume as plain text now.",
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body: unknown = await request.json();
    parsed = RequestSchema.parse(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(parsed) }],
    });

    const resume = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!resume) {
      return NextResponse.json(
        { error: "The model returned an empty rewrite. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ resume });
  } catch (err: unknown) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic authentication failed — check ANTHROPIC_API_KEY." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited by the Anthropic API. Try again shortly." }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Failed to rewrite the resume.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

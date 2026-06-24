import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Cover letter generation. Runs server-side so the Anthropic API key never
// reaches the browser. Grounds the letter in the resume + job posting and, when
// provided, the candidate's stated interests — and forbids inventing experience.

export const runtime = "nodejs";

const RequestSchema = z.object({
  resumeText: z.string().min(1).max(40_000),
  jobText: z.string().min(1).max(40_000),
  company: z.string().max(200).default(""),
  jobTitle: z.string().max(200).default(""),
  interests: z.string().max(4_000).default(""),
  context: z.string().max(40_000).default(""),
});

function buildSystemPrompt(): string {
  return [
    "You are an expert career writer helping a candidate write a cover letter for a specific job.",
    "Write in the candidate's own voice: first person, warm but professional, specific, and free of clichés (no \"I am writing to express my interest\", \"team player\", \"results-driven\", \"fast-paced environment\").",
    "Ground every claim in the resume provided. Never invent employers, titles, metrics, or skills the resume does not support. If you reference an achievement, it must appear in the resume.",
    "The letter must do two things: (1) articulate concretely why this candidate is a strong match for THIS role, mapping their real experience to the job's stated requirements; and (2) articulate what about this specific job and company genuinely connects to the candidate's interests.",
    "If the candidate provided a note about their interests, use it as the basis for the interest section. If they did not, infer plausible professional interest from the overlap between their resume and the posting, framed as what the role offers, not as invented personal anecdotes.",
    "If the candidate provided additional context materials (brag docs, project write-ups, etc.), you may draw on them as real, supported background — they count as grounding alongside the resume. Still never invent anything beyond what the resume and these materials support.",
    // --- Style constraints: avoid AI tells ---
    "PUNCTUATION: Never use em-dashes (—) or en-dashes (–). Use commas, periods, colons, or parentheses instead. Do not use a dash where a comma or period would work.",
    "Do NOT use these AI-tell sentence patterns: the negative-parallelism setup (\"it's not just X, it's Y\" / \"not only... but also\"); the rule-of-three triad (three parallel items in a row for rhythm); openers like \"What excites me most\", \"I'm thrilled/excited to\", \"I'm passionate about\", \"At the intersection of\", \"In today's ever-evolving/fast-paced...\".",
    "Avoid AI-tell vocabulary: delve, leverage, tapestry, testament, underscore, pivotal, realm, resonate, spearhead, navigate the landscape, deeply, truly, genuinely (as filler), moreover, furthermore. Avoid hollow intensifiers.",
    "Vary sentence structure and length; do not begin consecutive sentences or paragraphs the same way (e.g. not every sentence starting with \"I\"). Write plainly and concretely, the way a thoughtful person actually writes.",
    "Length: 250-400 words, 3-4 short paragraphs. Output ONLY the cover letter body text: no salutation block with addresses, no date, no markdown, no preamble, and no sign-off name placeholder beyond a simple closing like \"Sincerely,\".",
  ].join("\n");
}

// Safety net: the model occasionally emits em/en dashes despite the prompt.
// Replace any used as punctuation with a comma so the output never contains one.
function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ") // em/en dash, with any surrounding spaces
    .replace(/\s+,/g, ",") // tidy " ," produced above
    .replace(/,\s*,/g, ",") // collapse any doubled commas
    .replace(/,\s*\./g, ".") // ", ." -> "."
    .replace(/[ \t]{2,}/g, " ");
}

function buildUserPrompt(input: z.infer<typeof RequestSchema>): string {
  const { company, jobTitle, jobText, resumeText, interests, context } = input;
  return [
    `Target role: ${jobTitle || "(see posting)"}${company ? ` at ${company}` : ""}`,
    "",
    "=== JOB POSTING ===",
    jobText,
    "",
    "=== CANDIDATE RESUME ===",
    resumeText,
    "",
    context.trim() ? `=== CANDIDATE CONTEXT MATERIALS ===\n${context.trim()}\n` : "",
    interests.trim()
      ? `=== WHAT THE CANDIDATE SAYS INTERESTS THEM ABOUT THIS ROLE ===\n${interests.trim()}`
      : "(The candidate did not provide a note about their interests. Infer professional interest from the resume/posting overlap without fabricating personal details.)",
    "",
    "Write the cover letter now.",
  ].join("\n");
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body: unknown = await request.json();
    parsed = RequestSchema.parse(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(parsed) }],
    });

    const letter = stripDashes(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim()
    );

    if (!letter) {
      return NextResponse.json(
        { error: "The model returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ letter });
  } catch (err: unknown) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic authentication failed — check ANTHROPIC_API_KEY or run `ant auth login`." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited by the Anthropic API. Try again shortly." }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Failed to generate the cover letter.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

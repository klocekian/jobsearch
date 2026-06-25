import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_TEXT = 30_000;

const RequestSchema = z.object({
  text: z.string().min(1).max(100_000),
  url: z.string().max(2000).optional(),
});

const ResultSchema = z.object({
  company: z.string(),
  jobTitle: z.string(),
  location: z.string(),
  remoteType: z.enum(["remote", "hybrid", "onsite", ""]),
  salaryText: z.string(),
  jobDescription: z.string(),
});

const SYSTEM = [
  "You extract structured job-posting details from raw text that a user copied from a careers page.",
  "Return the hiring company name, job title, location, remote/hybrid/onsite classification, salary range (as text), and the full job description as clean plain text.",
  "jobDescription should include the substance of the posting: summary, responsibilities, requirements/qualifications, and any 'about the role' content.",
  "For salaryText, extract any compensation info mentioned (base, total comp, equity, bonus). Return empty string if not mentioned.",
  "For remoteType, return 'remote' if fully remote, 'hybrid' if hybrid/flexible, 'onsite' if in-office only, or empty string if unclear.",
  "Strip navigation, footer, cookie banners, and other non-posting content from jobDescription.",
  "Do not invent details. Only return what the text supports.",
].join("\n");

export async function POST(request: Request) {
  let text: string;
  let url: string | undefined;
  try {
    const body: unknown = await request.json();
    const parsed = RequestSchema.parse(body);
    text = parsed.text.slice(0, MAX_TEXT);
    url = parsed.url;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const userContent = [
      url ? `Source URL: ${url}\n` : "",
      `=== PAGE TEXT ===\n${text}`,
      "",
      "Extract the company, job title, location, remote type, salary, and full job description.",
    ].join("\n");

    const message = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });

    const result = message.parsed_output;
    if (!result || (!result.jobTitle.trim() && !result.jobDescription.trim())) {
      return NextResponse.json(
        { error: "Couldn't extract job details from that text." },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic auth failed." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited. Try again shortly." }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

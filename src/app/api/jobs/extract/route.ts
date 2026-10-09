import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/ai";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";

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

export const POST = withUser(async (request) => {
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
    const userContent = [
      url ? `Source URL: ${url}\n` : "",
      `=== PAGE TEXT ===\n${text}`,
      "",
      "Extract the company, job title, location, remote type, salary, and full job description.",
    ].join("\n");

    const { data: result } = await generateStructured({
      system: SYSTEM,
      prompt: userContent,
      schema: ResultSchema,
      schemaName: "JobExtractResult",
      maxTokens: 4096,
    });

    if (!result || (!result.jobTitle.trim() && !result.jobDescription.trim())) {
      return NextResponse.json(
        { error: "Couldn't extract job details from that text." },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    const status =
      message.includes("not connected") || message.includes("authentication failed") || message.includes("401")
        ? 401
        : message.includes("rate limit") || message.includes("429")
        ? 429
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
});

import { z } from "zod";
import { generateStructured } from "@/lib/ai";

// Pull a structured job posting out of page text — pasted by the user from a
// careers page (/api/jobs/extract, the extension) or fetched by URL
// (/api/fetch-job, which also passes any embedded JobPosting JSON-LD).

const MAX_TEXT = 30_000;

const JobExtractSchema = z.object({
  company: z.string(),
  jobTitle: z.string(),
  location: z.string(),
  remoteType: z.enum(["remote", "hybrid", "onsite", ""]),
  salaryText: z.string(),
  jobDescription: z.string(),
});

export type JobExtract = z.infer<typeof JobExtractSchema>;

const SYSTEM = [
  "You extract structured job-posting details from a careers page: either text a user copied from it, or a fetched web page (sometimes with its JSON-LD JobPosting data).",
  "Return the hiring company name, job title, location, remote/hybrid/onsite classification, salary range (as text), and the full job description as clean plain text.",
  "jobDescription should include the substance of the posting: summary, responsibilities, requirements/qualifications, and any 'about the role' content, as readable plain text (no HTML, no markdown).",
  "Use the JSON-LD JobPosting data when present; otherwise extract from the page text.",
  "For salaryText, extract any compensation info mentioned (base, total comp, equity, bonus). Return empty string if not mentioned.",
  "For remoteType, return 'remote' if fully remote, 'hybrid' if hybrid/flexible, 'onsite' if in-office only, or empty string if unclear.",
  "Strip navigation, footer, cookie banners, and other non-posting content from jobDescription.",
  "If the page is a login wall, a bot/captcha block, a job-search listing rather than a single posting, or otherwise not a single job posting, return empty strings for every field.",
  "Do not invent details. Only return what the text supports.",
].join("\n");

/** The extracted posting, or null when the text doesn't hold one. */
export async function extractJobPosting(
  userId: number,
  source: { text: string; url?: string; jsonLd?: string | null },
): Promise<JobExtract | null> {
  const prompt = [
    source.url ? `Source URL: ${source.url}\n` : "",
    source.jsonLd ? `=== JSON-LD JobPosting ===\n${source.jsonLd}\n` : "",
    `=== PAGE TEXT ===\n${source.text.slice(0, MAX_TEXT)}`,
    "",
    "Extract the company, job title, location, remote type, salary, and full job description.",
  ].join("\n");

  const { data } = await generateStructured(userId, {
    system: SYSTEM,
    prompt,
    schema: JobExtractSchema,
    schemaName: "JobExtractResult",
    maxTokens: 4096,
  });
  return data.jobTitle.trim() || data.jobDescription.trim() ? data : null;
}

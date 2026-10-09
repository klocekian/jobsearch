import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { withUser } from "@/lib/api-auth";

// Structure raw resume text into editable fields. Resume parsing by regex is
// brittle across formats (LinkedIn's grouped companies, two-column layouts,
// etc.), so we let the active AI provider do the structuring with a constrained JSON schema.
// The client persists the result, so this runs at most once per resume.

export const runtime = "nodejs";

const RequestSchema = z.object({
  resumeText: z.string().min(1).max(60_000),
});

const ExperienceSchema = z.object({
  role: z.string(),
  company: z.string(),
  dates: z.string(),
  bullets: z.array(z.string()),
});

const EducationSchema = z.object({
  degree: z.string(),
  school: z.string(),
  dates: z.string(),
});

const SectionSchema = z.object({
  heading: z.string(),
  items: z.array(z.string()),
});

const ResumeSchema = z.object({
  name: z.string(),
  headline: z.string(),
  location: z.string(),
  phone: z.string(),
  email: z.string(),
  website: z.string(),
  linkedin: z.string(),
  github: z.string(),
  substack: z.string(),
  summary: z.string(),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.string(),
  additionalSections: z.array(SectionSchema),
});

const SYSTEM = [
  "You convert raw resume text into structured fields. The text may come from a two-column or LinkedIn-exported PDF, so it can be slightly out of order.",
  "Extract the candidate's content faithfully. Do NOT invent, summarize, or omit content — preserve the candidate's exact wording for the summary and every bullet.",
  "Rules:",
  "- name, headline (the tagline under the name, if any), location, phone, email: from the contact/header area. Strip trailing parenthetical labels from contact fields, e.g. '(Mobile)', '(LinkedIn)', '(Portfolio)'.",
  "- linkedin: the LinkedIn profile URL (e.g. 'linkedin.com/in/...'), if present; empty string otherwise.",
  "- github: the GitHub profile URL (e.g. 'github.com/username'), if present; empty string otherwise.",
  "- substack: the Substack URL (e.g. 'name.substack.com'), if present; empty string otherwise.",
  "- website: a personal site or portfolio URL that is NOT LinkedIn, GitHub, or Substack; empty string otherwise.",
  "- summary: the full professional summary paragraph(s), verbatim.",
  "- experience: one entry per ROLE, newest first. role = job title; company = employer; dates = the date range exactly as written (e.g. 'June 2023 - Present'), without the parenthetical duration. For grouped companies (one company header with multiple roles beneath it), attach each role to that company.",
  "- bullets: each accomplishment paragraph as one string, in order. Do NOT include the location line or the 'X years Y months' tenure line as a bullet.",
  "- education: one entry per school. degree = the degree/field; school = institution; dates = years as written.",
  "- skills: a single string from the 'Skills' section. If the skills are grouped under sub-labels (e.g. 'Leadership', 'Craft'), preserve the grouping by formatting each group as 'Label: item, item' and separating groups with '; '. Otherwise a plain comma-separated list.",
  "- additionalSections: EVERY section that is not summary, experience, education, or skills. This includes Writing, Publications, Awards, Honors, Certifications, Projects, Speaking, Talks, Patents, Volunteer, Languages, Affiliations, and any other heading. For each, set heading to the section title and items to each entry/bullet/line, preserving the exact wording. Do NOT drop or merge these sections. If there are none, return an empty array.",
  "- Ignore page footers like 'Page 1 of 5'.",
].join("\n");

export const POST = withUser(async (request) => {
  let resumeText: string;
  try {
    const body: unknown = await request.json();
    resumeText = RequestSchema.parse(body).resumeText;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { data: resume } = await generateStructured({
      system: SYSTEM,
      prompt: `Resume text:\n\n${resumeText}`,
      schema: ResumeSchema,
      schemaName: "ParsedResume",
      maxTokens: 8000,
    });

    return NextResponse.json({ resume });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse the resume.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
});

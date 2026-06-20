// Best-effort parse of resume text into the structured ResumeData model.
// Heuristic by design — the editor lets the user correct anything, so the goal
// is to save typing, not to be perfect.

import { extractContact } from "../contact";
import type { ResumeData, ResumeExperience, ResumeEducation } from "./types";

type SectionKey = "summary" | "experience" | "education" | "skills";

const SECTION_PATTERNS: { key: SectionKey; re: RegExp }[] = [
  { key: "summary", re: /^(summary|professional summary|profile|objective|about(?: me)?)\b/i },
  { key: "experience", re: /^(work experience|professional experience|experience|employment(?: history)?|work history|career)\b/i },
  { key: "education", re: /^(education|academic(?: background)?)\b/i },
  { key: "skills", re: /^(skills|technical skills|core competencies|competencies|areas of expertise|expertise)\b/i },
];

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_TOKEN = `(?:${MONTH}\\s*\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const DATE_RANGE_RE = new RegExp(
  `${DATE_TOKEN}\\s*(?:to|through|–|—|-)\\s*(?:present|current|${DATE_TOKEN})`,
  "i"
);
const YEAR_RE = /\b(?:19|20)\d{2}\b/;

function classifyHeading(line: string): SectionKey | null {
  const t = line.trim();
  if (t.length > 40) return null; // headings are short
  for (const s of SECTION_PATTERNS) if (s.re.test(t)) return s.key;
  return null;
}

/** Pull a date range / year out of a header line, returning it plus the remainder. */
function splitDates(line: string): { dates: string; rest: string } {
  const range = line.match(DATE_RANGE_RE);
  if (range) {
    return { dates: range[0].trim(), rest: line.replace(range[0], "") };
  }
  const year = line.match(YEAR_RE);
  if (year) {
    return { dates: year[0], rest: line.replace(year[0], "") };
  }
  return { dates: "", rest: line };
}

/** Tidy a fragment left after removing dates: trim trailing separators. */
function tidy(s: string): string {
  return s.replace(/[\s,|·•–—-]+$/, "").replace(/^[\s,|·•–—-]+/, "").trim();
}

/** Split "Role, Company" / "Role at Company" / "Role — Company" into the two parts. */
function splitRoleCompany(text: string): { role: string; company: string } {
  const atMatch = text.match(/^(.*?)\s+(?:at|@)\s+(.*)$/i);
  if (atMatch) return { role: tidy(atMatch[1]), company: tidy(atMatch[2]) };
  const sepMatch = text.split(/\s+[–—|]\s+/);
  if (sepMatch.length >= 2) return { role: tidy(sepMatch[0]), company: tidy(sepMatch.slice(1).join(" ")) };
  const commaIdx = text.indexOf(",");
  if (commaIdx >= 0) return { role: tidy(text.slice(0, commaIdx)), company: tidy(text.slice(commaIdx + 1)) };
  return { role: tidy(text), company: "" };
}

function isExperienceHeader(line: string): boolean {
  return DATE_RANGE_RE.test(line) || /\bpresent\b/i.test(line) || /\b\d{1,2}\/\d{4}\b/.test(line);
}

function parseExperience(lines: string[]): ResumeExperience[] {
  const entries: ResumeExperience[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^[\s•·\-*–—>]+/, "").trim();
    if (!line) continue;
    if (isExperienceHeader(line)) {
      const { dates, rest } = splitDates(line);
      const { role, company } = splitRoleCompany(tidy(rest));
      entries.push({ role, company, dates, bullets: [] });
    } else if (entries.length > 0) {
      entries[entries.length - 1].bullets.push(line);
    } else {
      // A bullet before any recognizable header — start a header-less entry.
      entries.push({ role: "", company: "", dates: "", bullets: [line] });
    }
  }
  return entries.map((e) => ({ ...e, bullets: e.bullets.length ? e.bullets : [""] }));
}

function parseEducation(lines: string[]): ResumeEducation[] {
  return lines
    .map((raw) => raw.replace(/^[\s•·\-*–—>]+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const { dates, rest } = splitDates(line);
      const { role: degree, company: school } = splitRoleCompany(tidy(rest));
      return { degree, school, dates };
    });
}

export function parseResume(resumeText: string): ResumeData {
  const contact = extractContact(resumeText);
  const lines = resumeText.split(/\n+/).map((l) => l.trim());

  const sections: Record<SectionKey, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
  };

  let current: SectionKey | null = null;
  for (const line of lines) {
    if (!line) continue;
    const heading = classifyHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    if (current) sections[current].push(line);
  }

  const summary = sections.summary.join(" ").replace(/\s+/g, " ").trim();
  const skills = sections.skills
    .join(", ")
    .split(/[,•·|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  // Separate the LinkedIn profile URL from a personal/portfolio site.
  const linkedin = resumeText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+/i)?.[0] ?? "";
  const website = /linkedin\.com/i.test(contact.website) ? "" : contact.website;

  return {
    name: contact.name,
    headline: "",
    location: contact.address,
    phone: contact.phone,
    email: contact.email,
    website,
    linkedin,
    summary,
    experience: parseExperience(sections.experience),
    education: parseEducation(sections.education),
    skills,
  };
}

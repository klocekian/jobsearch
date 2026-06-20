// Module 1: ATS Structural Analysis.
// Checks the document for the signals ATS systems use to parse a resume, and
// reports pass / warning / fail with a plain-language reason for each.

import type { AnalyzeInput, CheckItem, SearchabilityGroup } from "./types";
import { EMAIL_RE, PHONE_RE } from "./text";

const SECTION_LABELS = {
  education: /\b(education|academic|degree|university|college|b\.?s\.?|b\.?a\.?|m\.?s\.?|mba|ph\.?d)\b/i,
  experience: /\b(work experience|professional experience|experience|employment|work history)\b/i,
  skills: /\b(skills|competencies|expertise|proficiencies)\b/i,
};

const ADDRESS_RE = /\b(\d{1,5}\s+\w+(\s\w+){0,3}\s(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive))\b|\b[A-Z][a-z]+,\s?[A-Z]{2}\b|\b[A-Z][a-z]+,\s?[A-Z][a-z]+\b/;
const DATE_RE = /\b((0?[1-9]|1[0-2])\/\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\b/i;
const DEGREE_LEVELS: [RegExp, number][] = [
  [/\bph\.?d|doctorate\b/i, 4],
  [/\bm\.?s\.?|m\.?a\.?|mba|master/i, 3],
  [/\bb\.?s\.?|b\.?a\.?|bachelor/i, 2],
  [/\bassociate\b/i, 1],
];

function degreeLevel(text: string): number {
  for (const [re, lvl] of DEGREE_LEVELS) if (re.test(text)) return lvl;
  return 0;
}

// PDFs often render section headings with letter-spacing (tracking), which text
// extraction returns as "S U M M A R Y" / "E X P E R I E N C E". Collapse any
// run of 3+ single letters separated by single spaces so heading detection sees
// the real word. Used only for the structural section checks.
function despaceHeadings(text: string): string {
  return text.replace(/\b(?:[A-Za-z] ){2,}[A-Za-z]\b/g, (m) => m.replace(/ /g, ""));
}

export function analyzeSearchability(input: AnalyzeInput): SearchabilityGroup[] {
  const { resumeText, jobText, jobTitle, fileName } = input;
  // Letter-spacing-tolerant copy for heading/section detection.
  const normalized = despaceHeadings(resumeText);
  const groups: SearchabilityGroup[] = [];

  // Contact completeness.
  const contact: CheckItem[] = [];
  contact.push(
    ADDRESS_RE.test(resumeText)
      ? { status: "pass", message: "You provided your physical address. Recruiters use your address to validate your location for job matches." }
      : { status: "fail", message: "No physical address found. Many ATS use address to validate geographic eligibility for a role." }
  );
  contact.push(
    EMAIL_RE.test(resumeText)
      ? { status: "pass", message: "You provided your email. Recruiters use your email to contact you for job matches." }
      : { status: "fail", message: "No email address found. ATS require a parseable email to route your application." }
  );
  contact.push(
    PHONE_RE.test(resumeText)
      ? { status: "pass", message: "You provided your phone number." }
      : { status: "fail", message: "No phone number found. Add one so recruiters can reach you." }
  );
  groups.push({ label: "Contact Information", items: contact });

  // Summary section. Look near the top, on the heading-normalized text.
  const hasSummary = /\b(summary|objective|profile|about me)\b/i.test(normalized.slice(0, 800));
  groups.push({
    label: "Summary",
    items: [
      hasSummary
        ? { status: "pass", message: "We found a summary section on your resume. Good job! The summary gives recruiters and hiring managers a quick overview of the value you can offer in the position." }
        : { status: "fail", message: "No summary section found. ATS often use this block for candidate classification before human review. Add a short summary near the top." },
    ],
  });

  // Section headings.
  const headings: CheckItem[] = [];
  headings.push(
    SECTION_LABELS.education.test(normalized)
      ? { status: "pass", message: "We found the education section in your resume." }
      : { status: "warning", message: "We could not confidently find an education section. Use a standard 'Education' heading." }
  );
  headings.push(
    SECTION_LABELS.experience.test(normalized)
      ? { status: "pass", message: "We found the work experience section in your resume." }
      : { status: "warning", message: "We could not find a work experience section. Use a standard 'Work Experience' heading." }
  );
  headings.push(
    DATE_RE.test(resumeText)
      ? { status: "pass", message: "We found work history in your resume." }
      : { status: "warning", message: "We could not detect dated work history. ATS use dates to build your work timeline." }
  );
  groups.push({ label: "Section Headings", items: headings });

  // Job title match.
  if (!jobTitle.trim()) {
    groups.push({
      label: "Job Title Match",
      items: [
        {
          status: "warning",
          message:
            "Add the target job title above to check whether the exact title appears in your resume — recruiters frequently search ATS by job title.",
        },
      ],
    });
  } else {
    const titleInResume = new RegExp(jobTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(resumeText);
    groups.push({
      label: "Job Title Match",
      items: [
        titleInResume
          ? { status: "pass", message: `The job title '${jobTitle}' from the job description was found in your resume.` }
          : { status: "fail", message: `The job title '${jobTitle}' from the job description was not found in your resume. We recommend having the exact title of the job for which you're applying in your resume. This ensures you'll be found when a recruiter searches by job title. If you haven't held this position before, include it as part of your summary statement.` },
      ],
    });
  }

  // Date formatting.
  groups.push({
    label: "Date Formatting",
    items: [
      DATE_RE.test(resumeText)
        ? { status: "pass", message: "The dates in your work experience section are properly formatted." }
        : { status: "warning", message: "Employment dates are missing or use an ambiguous format. Use MM/YYYY or Month YYYY consistently." },
    ],
  });

  // Education match.
  const resumeDeg = degreeLevel(resumeText);
  const jobDeg = degreeLevel(jobText);
  groups.push({
    label: "Education Match",
    items: [
      jobDeg === 0
        ? { status: "pass", message: "The job description does not specify a required education level." }
        : resumeDeg >= jobDeg
          ? { status: "pass", message: `Your education matches the ${jobDeg >= 3 ? "required" : "preferred"} education level listed in the job description.` }
          : { status: "warning", message: "Your stated education appears below the level requested in the job description. Confirm your degree is clearly listed." },
    ],
  });

  // File type & naming — only when a resume file was actually uploaded.
  // (Pasted text has no filename, so these checks would be meaningless.)
  if (fileName.trim()) {
    const fileItems: CheckItem[] = [];
    const isPdf = /\.pdf$/i.test(fileName);
    fileItems.push(
      isPdf
        ? { status: "pass", message: "You are using a .pdf resume, which is the preferred format for most ATS systems." }
        : { status: "warning", message: "Your file is not a PDF. PDF is the preferred format for most ATS systems." }
    );
    const cleanName = !/[^A-Za-z0-9._\- ]/.test(fileName);
    const hasSpaces = /\s/.test(fileName.replace(/\.[^.]+$/, ""));
    fileItems.push(
      hasSpaces || !cleanName
        ? { status: "fail", message: "Remove spaces or special characters from your file name. These characters can cause errors in some ATS." }
        : { status: "pass", message: "Your file name is concise and readable." }
    );
    groups.push({ label: "File Type", items: fileItems });
  }

  return groups;
}

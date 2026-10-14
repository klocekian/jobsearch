// Diagnostics for the PDF text layer, independent of match scoring.
// Use raw extracted text so normalization cannot hide tracking or page breaks.

import type { CheckItem } from "./types";
import { despaceHeadings } from "./searchability";
import { EMAIL_RE, PHONE_RE } from "./text";

const SECTION_HEADINGS = new Set([
  "summary", "profile", "objective", "experience", "work experience",
  "professional experience", "education", "skills", "technical skills",
  "core competencies", "projects", "certifications",
]);
const GLUED_SECTION_HEADINGS = new Set(
  [...SECTION_HEADINGS].filter((section) => section.includes(" ")).map((section) => section.replace(/ /g, ""))
);
const CONTACT_LINES = 8;
const MIN_LETTERS = 40;
const LONG_UNSPACED_WORD = 32;

function heading(line: string): string | null {
  const normalized = despaceHeadings(line).replace(/[^A-Za-z ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return SECTION_HEADINGS.has(normalized) ? normalized : null;
}

/** Inspect text as an ATS would receive it. `expected` is optional source text for round-trip checks. */
export function checkParseFidelity(extractedText: string, expected?: string): CheckItem[] {
  const lines = extractedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const letterCount = (extractedText.match(/[A-Za-z]/g) ?? []).length;
  if (letterCount < MIN_LETTERS) {
    return [{ status: "fail", message: "Very little selectable text was found. This PDF may be image-only; upload a text-based PDF or paste the resume text." }];
  }

  const items: CheckItem[] = [];
  const words = extractedText.match(/\S+/g) ?? [];
  const gluedWords = words.some((word) => {
    const bare = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
    return /^[A-Za-z]+$/.test(bare) &&
      (bare.length >= LONG_UNSPACED_WORD || GLUED_SECTION_HEADINGS.has(bare.toLowerCase()));
  });
  items.push(gluedWords
    ? { status: "warning", message: "Some words appear joined without spaces. Check the extracted resume text for missing word breaks." }
    : { status: "pass", message: "Word spacing looks readable." });

  const trackedHeading = lines.some((line) => heading(line) !== null && despaceHeadings(line) !== line);
  items.push(trackedHeading
    ? { status: "warning", message: "Section headings in this PDF are letter-spaced. We corrected them in the saved text, but some parsers read the original as separate letters." }
    : { status: "pass", message: "Section headings are not letter-spaced." });

  items.push(/[\uFB00-\uFB06]/u.test(extractedText)
    ? { status: "warning", message: "The PDF text contains ligature characters. Check that words with joined letters parse correctly." }
    : { status: "pass", message: "No ligature characters were found." });

  items.push(/[\uE000-\uF8FF]/u.test(extractedText)
    ? { status: "warning", message: "The PDF text contains private-use glyphs, often from icon fonts. Replace icons that carry contact or section information with text." }
    : { status: "pass", message: "No private-use glyphs were found." });

  items.push({ status: "pass", message: "The PDF contains selectable text." });

  // Text-only signals cannot prove a visual column layout. These patterns flag
  // cases where two independent columns have landed on the same text line.
  const pairedLines = lines.filter((line) => /\S[ \t]{3,}\S/.test(line)).length;
  const mergedHeadings = lines.some((line) =>
    (line.match(/(?:^|[ \t]{2,})(?:summary|profile|experience|education|skills|projects)(?=[ \t]{2,}|$)/gi) ?? []).length >= 2
  );
  items.push(pairedLines >= 2 || mergedHeadings
    ? { status: "warning", message: "Text from two columns may be interleaved. Review the extracted reading order." }
    : { status: "pass", message: "No obvious column interleaving was found." });

  const sections = lines.map(heading).filter((section): section is string => section !== null);
  const summaryAt = sections.findIndex((section) => ["summary", "profile", "objective"].includes(section));
  const summaryLate = summaryAt > 0 && sections.slice(0, summaryAt).some((section) =>
    ["experience", "work experience", "professional experience", "education", "skills", "technical skills"].includes(section)
  );
  items.push(summaryLate
    ? { status: "warning", message: "The summary appears after another main section in extracted text. Check section reading order." }
    : { status: "pass", message: "Section heading order looks sensible." });

  const earlyContact = lines.slice(0, CONTACT_LINES).join("\n");
  items.push(EMAIL_RE.test(earlyContact) && PHONE_RE.test(earlyContact)
    ? { status: "pass", message: "Email and phone appear near the start of the resume." }
    : { status: "warning", message: "Email or phone is missing from the first eight nonempty lines. Put contact details near the top." });

  if (expected?.trim()) {
    const expectedContact = [expected.match(EMAIL_RE)?.[0], expected.match(PHONE_RE)?.[0]].filter((value): value is string => !!value);
    const missing = expectedContact.filter((value) => !extractedText.includes(value));
    items.push(missing.length
      ? { status: "warning", message: "A contact detail from the source text did not survive PDF extraction." }
      : { status: "pass", message: "Source contact details survived PDF extraction." });
  }

  return items;
}

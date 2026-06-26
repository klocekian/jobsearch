// Best-effort extraction of the candidate's contact details from resume text,
// used to prefill the cover-letter PDF header. Every field is editable in the
// UI, so imperfect extraction is fine — this just saves typing.

import { EMAIL_RE } from "./analysis/text";

const STREET_RE =
  /\b\d{1,5}\s+\w+(?:\s\w+){0,4}\s(?:st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive|way|ct|court)\b[^,\n]*(?:,\s*[A-Z]{2}\s*\d{5})?/;
const CITY_STATE_RE =
  /\b((?:San|Los|New|Las|Salt Lake|El|St\.?|Fort|West|East|North|South|Mount|Palm|Palo|Santa|Corpus|Grand|Baton|Des)\s[A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?|[A-Z][a-zA-Z.]+),\s*([A-Z]{2}|[A-Z][a-zA-Z]+)\b/g;

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
  // Countries / regions
  "UK","US","USA",
]);
// Bare domain or full URL (not preceded by "@", so email domains are excluded).
const WEBSITE_RE =
  /(?<!@)\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|io|dev|me|design|co|net|org|app|xyz|info)\b(?:\/[^\s]*)?/i;

export interface Contact {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

// Section-heading / document words that must never be mistaken for a name.
const NON_NAME_WORDS = new Set([
  "contact", "summary", "profile", "objective", "about", "resume", "curriculum",
  "vitae", "cv", "experience", "employment", "education", "skills", "work",
  "references", "portfolio", "projects", "qualifications",
]);

function looksLikeName(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  // Real names are typically 2-4 tokens; a lone capitalized word is almost
  // always a section heading ("Contact", "Summary"), so require at least two.
  if (tokens.length < 2 || tokens.length > 4) return false;
  if (/[\d@]/.test(line)) return false;
  if (tokens.some((t) => NON_NAME_WORDS.has(t.toLowerCase()))) return false;
  // Each token starts uppercase (allow lowercase particles like "de", "van").
  return tokens.every((t) => /^[A-Z][a-zA-Z.'-]*$/.test(t) || /^(de|van|der|la|von)$/i.test(t));
}

/** Strip leading Markdown markers (#, -, *, _) and surrounding emphasis. */
function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^[*_]+|[*_]+$/g, "")
    .trim();
}

/** First phone-shaped run with a real phone digit count (10-15), so ISO dates
 * like "2026-06-19" (8 digits) and short numbers aren't mistaken for a phone. */
function extractPhone(text: string): string {
  for (const m of text.matchAll(/\(?\+?\d[\d\s().-]{7,}\d/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return m[0].trim();
  }
  return "";
}

export function extractContact(resumeText: string): Contact {
  const lines = resumeText
    .split(/\n+/)
    .map((l) => stripMarkdown(l.trim()))
    .filter(Boolean);

  // Name: first top line that reads like a name (after stripping markdown).
  let name = "";
  for (const line of lines.slice(0, 6)) {
    if (looksLikeName(line)) {
      name = line;
      break;
    }
  }

  // Anchor on the line that contains the email — the real contact line — so the
  // headline (which can contain "Word, Word" fragments and numbers) isn't
  // mistaken for the location or phone. Fall back to the top block.
  const topBlock = lines.slice(0, 8).join("\n");
  const contactLine = lines.find((l) => l.match(EMAIL_RE)) ?? topBlock;

  const email = contactLine.match(EMAIL_RE)?.[0] ?? resumeText.match(EMAIL_RE)?.[0] ?? "";
  const phone = extractPhone(contactLine) || extractPhone(topBlock);
  // Website may sit on a separate line from the email; the top block is safe to
  // scan (body URLs further down are not), and the headline rarely has a domain.
  const website = (contactLine.match(WEBSITE_RE)?.[0] ?? topBlock.match(WEBSITE_RE)?.[0] ?? "").trim();
  let address = (contactLine.match(STREET_RE)?.[0] ?? "").trim();
  if (!address) {
    let lastMatch = "";
    for (const m of contactLine.matchAll(CITY_STATE_RE)) {
      if (US_STATES.has(m[2])) lastMatch = m[0].trim();
    }
    address = lastMatch;
    if (!address) {
      for (const m of topBlock.matchAll(CITY_STATE_RE)) {
        if (US_STATES.has(m[2])) lastMatch = m[0].trim();
      }
      address = lastMatch;
    }
  }

  return { name, address, email, phone, website };
}

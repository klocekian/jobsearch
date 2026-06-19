// Shared text utilities used across the analysis modules.

const WORD_RE = /[A-Za-z][A-Za-z'+-]*/g;

export function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function wordCount(text: string): number {
  return words(text).length;
}

/** Count non-overlapping, case-insensitive occurrences of a phrase. */
export function countPhrase(haystack: string, phrase: string): number {
  if (!phrase.trim()) return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word boundary on both sides where the phrase is alphanumeric-bounded.
  const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi");
  return (haystack.match(re) ?? []).length;
}

/** Split text into sentences for tone / structure analysis. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
export const URL_RE = /(https?:\/\/[^\s)]+|(?:www\.)[^\s)]+|[a-z0-9-]+\.(?:com|io|dev|me|design|co)\/[^\s)]*)/i;

const CONTACT_LABEL_RE = /^(linkedin|portfolio|github|website|web|email|e-mail|phone|mobile|tel|address|location)\b/i;
// "City, ST" or "City, State" location lines.
const LOCATION_RE = /^[A-Z][a-zA-Z.]+(?:[\s-][A-Z][a-zA-Z.]+)*,\s*[A-Z][a-zA-Z.]+$/;

/**
 * True for lines that are structured contact/header data rather than prose:
 * names, locations, emails, phone numbers, and profile links. These must not be
 * treated as accomplishments to rewrite, nor fed to prose-based AI detection.
 */
export function isStructuredLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (EMAIL_RE.test(t)) return true;
  if (URL_RE.test(t)) return true;
  if (CONTACT_LABEL_RE.test(t)) return true;
  // A line dominated by a phone number (few non-phone characters).
  if (PHONE_RE.test(t) && t.replace(/[\d\s().+-]/g, "").length < 8) return true;

  const tokens = t.split(/\s+/);
  if (tokens.length <= 4 && LOCATION_RE.test(t)) return true;
  // A bare name / header: 2-3 capitalized words, no digits, no end punctuation.
  const allCapitalized = tokens.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w));
  if (tokens.length >= 2 && tokens.length <= 3 && allCapitalized && !/[\d.!?]$/.test(t)) {
    return true;
  }
  return false;
}

/** Lines that look like resume bullet points (prose accomplishments). */
export function bulletLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•·\-*–—>]+/, "").trim())
    .filter((l) => l.length > 12 && /[a-z]/i.test(l) && !isStructuredLine(l));
}

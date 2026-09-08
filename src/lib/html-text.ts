/**
 * Convert HTML posting text to readable plain text.
 *
 * Postings arrive by four routes — the extension's JSON-LD read, the
 * extension's page walk, /api/fetch-job, and /api/jobs/extract — and any of
 * them can let rich-text markup through (a model echoing a JSON-LD
 * `description` verbatim is the common case). Rather than patch each route,
 * this normalizes at the write boundary.
 *
 * Structure is preserved deliberately. The fitness check quotes requirements
 * verbatim, and requirements are nearly always list items: flattening
 * `<li>` into one run-on paragraph makes them harder to separate and quote.
 * Bullets become "- " lines, paragraphs keep their breaks.
 */

const ENTITIES: [RegExp, string][] = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#0?39;|&apos;|&rsquo;/gi, "'"],
  [/&lsquo;/gi, "'"],
  [/&ldquo;|&rdquo;/gi, '"'],
  [/&mdash;/gi, "—"],
  [/&ndash;/gi, "–"],
  [/&bull;/gi, "•"],
  [/&hellip;/gi, "…"],
];

/**
 * True when the text carries real block markup — not merely an angle bracket.
 * Guards against mangling legitimate text like "salary < 100k" or "#include
 * <vector>" in a posting that was never HTML to begin with.
 */
export function looksLikeHtml(text: string): boolean {
  if (!text) return false;
  const blockTags = text.match(/<\s*\/?\s*(p|div|li|ul|ol|br|h[1-6]|table|tr|td|section|article|span|strong|em)\b[^>]*>/gi);
  return (blockTags?.length ?? 0) >= 3;
}

export function htmlToText(input: string): string {
  let s = input;

  // Drop non-content elements entirely, including their contents.
  s = s.replace(/<(script|style|noscript|svg|head|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // Line breaks.
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");

  // List items become bullets, so requirement lists stay one-per-line.
  s = s.replace(/<\s*li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\s*\/\s*li\s*>/gi, "\n");

  // Block boundaries become paragraph breaks.
  s = s.replace(/<\s*\/\s*(p|div|h[1-6]|section|article|tr|blockquote|ul|ol)\s*>/gi, "\n\n");
  s = s.replace(/<\s*(p|div|h[1-6]|section|article|blockquote)\b[^>]*>/gi, "\n\n");

  // Table cells shouldn't run together.
  s = s.replace(/<\s*\/\s*(td|th)\s*>/gi, "  ");

  // Everything else goes, leaving its text.
  s = s.replace(/<[^>]+>/g, "");

  for (const [re, rep] of ENTITIES) s = s.replace(re, rep);
  s = s.replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)));

  return s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(^|\n)- (?=\n)/g, "$1")   // drop bullets that ended up empty
    .trim();
}

/** Normalize only when the text actually looks like markup. Otherwise untouched. */
export function normalizePostingText(text: string | undefined | null): string {
  if (!text) return "";
  return looksLikeHtml(text) ? htmlToText(text) : text;
}

// Client-side PDF text extraction using pdfjs-dist.
// Runs entirely in the browser so resume files never leave the device —
// consistent with the privacy stance in the product spec.
//
// Two-column resumes (e.g. LinkedIn exports with a sidebar) are common and
// break naive y-grouping: a sidebar item and a main-column item at the same
// vertical position get merged into one scrambled line. So we detect a vertical
// gutter, split the page into columns, read each column top-to-bottom (main
// column first), and mark paragraph breaks from larger vertical gaps.

interface TextItemLike {
  str: string;
  transform: number[];
  width?: number;
}

export interface PdfExtractResult {
  text: string;
  pages: number;
}

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  // Dynamic import keeps pdfjs out of the server bundle and off the initial load.
  const pdfjs = await import("pdfjs-dist");

  // Resolve the worker via a bundler-friendly URL (Turbopack/webpack rewrite this).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  const pages = doc.numPages;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageWidth = page.getViewport({ scale: 1 }).width;
    // Header protection only applies to page 1 (the document header lives there).
    pageTexts.push(pageToText(content.items as TextItemLike[], pageWidth, i === 1));
  }
  await loadingTask.destroy();

  return { text: collapseLetterSpacing(stitchPageBreaks(pageTexts.join("\n\n").trim())), pages };
}

/**
 * Rejoin a bullet/paragraph that was split by a page break: pages are joined
 * with a blank line, so a sentence continuing across pages ends up on two
 * logical lines. Drop the blank (and join) when the line before it does not end
 * a sentence and the next line is not a heading or new bullet.
 */
function stitchPageBreaks(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      const prev = out[out.length - 1] ?? "";
      const next = lines[j] ?? "";
      const canStitch =
        prev !== "" &&
        next !== "" &&
        !ENDS_SENTENCE.test(prev) &&
        !isHeadingLine(prev) &&
        !isHeadingLine(next) &&
        !BULLET_RE.test(next);
      if (canStitch) {
        out[out.length - 1] = prev + (prev.endsWith("-") ? "" : " ") + next;
        i = j; // consume the joined line
        continue;
      }
      out.push("");
    } else {
      out.push(lines[i]);
    }
  }
  return out.join("\n");
}

/**
 * PDFs frequently render headings with letter-spacing (tracking), so the text
 * layer emits each glyph as its own item and extraction yields "S U M M A R Y".
 * Collapse any run of 3+ single letters separated by single spaces back into a
 * word, so headings parse correctly downstream.
 */
function collapseLetterSpacing(text: string): string {
  return text.replace(/\b(?:[A-Za-z] ){2,}[A-Za-z]\b/g, (m) => m.replace(/ /g, ""));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Find the x-coordinate of a vertical gutter splitting the page into two
 * columns, or null if the page is single-column. Works by projecting every
 * text item onto the x-axis and looking for a band with zero coverage.
 */
function detectColumnSplit(items: TextItemLike[], pageWidth: number): number | null {
  const intervals = items
    .filter((i) => i.str.trim())
    .map((i): [number, number] => {
      const x = i.transform[4];
      const w = i.width ?? i.str.length * 4;
      return [x, x + w];
    })
    .sort((a, b) => a[0] - b[0]);
  if (intervals.length < 2) return null;

  const merged: [number, number][] = [[...intervals[0]]];
  for (const [s, e] of intervals.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1] + 2) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  let bestMid: number | null = null;
  let bestW = 0;
  for (let i = 0; i < merged.length - 1; i++) {
    const gap = merged[i + 1][0] - merged[i][1];
    if (gap > bestW) {
      bestW = gap;
      bestMid = (merged[i][1] + merged[i + 1][0]) / 2;
    }
  }

  if (bestMid == null || bestW < Math.max(22, pageWidth * 0.035)) return null;
  if (bestMid < pageWidth * 0.12 || bestMid > pageWidth * 0.88) return null;
  const left = items.filter((i) => i.str.trim() && i.transform[4] < bestMid).length;
  const right = items.filter((i) => i.str.trim() && i.transform[4] >= bestMid).length;
  if (left < 3 || right < 3) return null;
  return bestMid;
}

interface VLine {
  y: number;
  parts: { x: number; w: number; str: string }[];
}

/**
 * Join the items on a line. A PDF emits a word as several text items when it
 * uses ligatures (the "fi"/"fl" glyph) or kerning, so joining with a blank
 * space inserts spaces *inside* words ("de fi ne" for "define"). Instead, add a
 * space only when there is a real horizontal gap between two items; adjacent
 * items are concatenated. A tracked, letter-spaced heading still produces
 * spaces here and is collapsed separately.
 */
function lineText(line: VLine): string {
  const parts = [...line.parts].sort((a, b) => a.x - b.x);
  // Estimate a space threshold from the typical character width on this line.
  // Intra-word gaps (ligatures/kerning) measure ~0; real inter-word spaces can
  // be as narrow as ~0.2 char-widths in some fonts, so the threshold sits below
  // that to avoid gluing words together ("forAI") while still merging ligatures.
  const charWidths = parts.filter((p) => p.str.length).map((p) => p.w / p.str.length);
  const space = (median(charWidths) || 4) * 0.12;

  let out = "";
  let prevEnd: number | null = null;
  for (const p of parts) {
    if (prevEnd === null) {
      out = p.str;
    } else {
      const gap = p.x - prevEnd;
      const needsSpace = gap > space && !/\s$/.test(out) && !/^\s/.test(p.str);
      out += (needsSpace ? " " : "") + p.str;
    }
    prevEnd = p.x + p.w;
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** Read one column top-to-bottom, inserting blank lines at paragraph breaks. */
function columnToText(items: TextItemLike[], applyHeader: boolean): string {
  const tolerance = 3;
  const lines: VLine[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let line = lines.find((l) => Math.abs(l.y - y) <= tolerance);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, w: item.width ?? item.str.length * 4, str: item.str });
  }

  // PDF y-origin is bottom-left, so larger y is higher on the page.
  lines.sort((a, b) => b.y - a.y);

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
  const typical = median(gaps) || 12;

  return reflowLines(lines, typical, applyHeader);
}

const BULLET_RE = /^\s*[•·▪◦‣⁃●○∙*]\s*|^\s*[-–]\s+/;
// Only true sentence terminators end a logical line; ";" and ":" appear mid-bullet.
const ENDS_SENTENCE = /[.!?]["'”’)\]]?$/;

// Common résumé section headings, matched case-insensitively (many résumés use
// Title Case headings like "Summary", not ALL CAPS).
const SECTION_HEADINGS = new Set([
  "summary", "profile", "objective", "about", "experience", "work experience",
  "professional experience", "employment", "work history", "education", "skills",
  "technical skills", "core competencies", "projects", "writing", "publications",
  "selected publications", "selected writing", "awards", "honors", "certifications",
  "certification", "speaking", "talks", "patents", "volunteer", "languages",
  "affiliations", "interests", "leadership", "achievements", "references",
]);

/** A section heading: a known heading word (any case) or a short all-caps line
 * (e.g. "SUMMARY", "S K I L L S"). */
function isHeadingLine(text: string): boolean {
  const word = text.replace(/[^A-Za-z ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (SECTION_HEADINGS.has(word)) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && text.length <= 42 && letters === letters.toUpperCase();
}

/**
 * Reflow visual lines into logical lines (whole bullets / paragraphs), undoing
 * the soft wraps a PDF introduces. A line continues the previous one unless the
 * previous logical line already ended a sentence — so wrapped lines (which end
 * mid-phrase) join, while distinct bullets/paragraphs (which end with
 * punctuation) stay apart, even with no bullet glyph. Section headings, bullet
 * markers, paragraph gaps, and the header block (before the first heading) all
 * force a new line so contact details and headings stay separate.
 */
function reflowLines(lines: VLine[], typical: number, applyHeader: boolean): string {
  const texts = lines.map(lineText);
  // Only the document header (page 1, before the first heading) is protected;
  // on later pages there is no header, so content must reflow normally.
  const firstHeading = applyHeader ? texts.findIndex((t) => isHeadingLine(t)) : -1;

  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < lines.length; i++) {
    const t = texts[i];
    if (!t) continue;
    const bigGap = i > 0 && lines[i - 1].y - lines[i].y > typical * 1.6;
    const inHeader = firstHeading >= 0 && i < firstHeading;
    const newLine =
      cur === "" ||
      bigGap ||
      inHeader ||
      isHeadingLine(t) ||
      isHeadingLine(cur) ||
      BULLET_RE.test(t) ||
      ENDS_SENTENCE.test(cur);
    if (newLine) {
      if (cur) out.push(cur);
      if (bigGap) out.push("");
      cur = t;
    } else {
      cur += cur.endsWith("-") ? t : ` ${t}`;
    }
  }
  if (cur) out.push(cur);
  return out.join("\n");
}

function pageToText(items: TextItemLike[], pageWidth: number, isFirstPage: boolean): string {
  const split = detectColumnSplit(items, pageWidth);
  if (split == null) return columnToText(items, isFirstPage);

  const left = items.filter((i) => i.transform[4] < split);
  const right = items.filter((i) => i.transform[4] >= split);
  // Order columns by text volume so the main content column comes first; a
  // narrow sidebar (contact, skills) follows.
  return [left, right]
    .map((col) => ({ col, len: col.reduce((n, i) => n + i.str.length, 0) }))
    .sort((a, b) => b.len - a.len)
    .map((o) => columnToText(o.col, isFirstPage))
    .join("\n\n");
}

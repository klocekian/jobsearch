// Shared PDF design system for the resume and cover letter, so both share one
// clean visual language. Deliberately ATS-safe: a single column, no tables or
// text boxes, standard fonts, and standard section headings — all of which
// machine parsers read reliably — paired with strong typographic hierarchy.

import type { jsPDF } from "jspdf";

/** Strip markdown syntax that the AI rewrite may leave in the text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")       // heading prefixes
    .replace(/^---+\s*$/gm, "")         // horizontal rules
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // **bold**
    .replace(/\*([^*]+)\*/g, "$1")      // *italic*
    .replace(/\s+$/gm, "")             // trailing whitespace per line
    .trim();
}

type RGB = readonly [number, number, number];

export const THEME = {
  font: "helvetica",
  margin: 56,
  ink: [17, 24, 39] as RGB, // near-black for body
  strong: [15, 23, 42] as RGB, // name / headings
  muted: [100, 116, 139] as RGB, // contact line, dates
  rule: [203, 213, 225] as RGB, // hairline dividers
};

export interface HeaderInfo {
  name: string;
  headline?: string;
  /** Contact details rendered on one line, joined with a separator. */
  details: string[];
  /** URLs rendered on their own line below the details (keeps them from overflowing). */
  links?: string[];
}

/** Thin layout wrapper over jsPDF: a top-down cursor with pagination. */
export class PdfBuilder {
  readonly doc: jsPDF;
  readonly pageW: number;
  readonly pageH: number;
  readonly margin: number;
  readonly contentW: number;
  private y: number;

  constructor(doc: jsPDF, margin: number = THEME.margin) {
    this.doc = doc;
    this.margin = margin;
    this.pageW = doc.internal.pageSize.getWidth();
    this.pageH = doc.internal.pageSize.getHeight();
    this.contentW = this.pageW - margin * 2;
    this.y = margin + 18;
  }

  private color(rgb: RGB) {
    this.doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  private breakIfNeeded(lineHeight: number) {
    if (this.y + lineHeight > this.pageH - this.margin) {
      this.doc.addPage();
      this.y = this.margin + lineHeight;
    }
  }

  space(h: number) {
    this.y += h;
  }

  /** Wrapped paragraph text. */
  paragraph(
    text: string,
    opts: { size?: number; style?: "normal" | "bold" | "italic"; color?: RGB; lineHeight?: number; gapAfter?: number } = {}
  ) {
    const { size = 10.5, style = "normal", color = THEME.ink, lineHeight = 1.45, gapAfter = 0 } = opts;
    this.doc.setFont(THEME.font, style);
    this.doc.setFontSize(size);
    this.color(color);
    const lh = size * lineHeight;
    for (const ln of this.doc.splitTextToSize(text, this.contentW) as string[]) {
      this.breakIfNeeded(lh);
      this.doc.text(ln, this.margin, this.y);
      this.y += lh;
    }
    this.y += gapAfter;
  }

  /** Name + optional headline + one contact line + divider rule. */
  header(info: HeaderInfo) {
    if (info.name) {
      this.doc.setFont(THEME.font, "bold");
      this.doc.setFontSize(23);
      this.color(THEME.strong);
      this.doc.text(info.name, this.margin, this.y);
      this.y += 23 * 1.1;
    }
    // Render text that wraps across the content width (headlines and contact
    // lines can get long; a single doc.text call would clip at the margin).
    const renderWrapped = (text: string, size: number) => {
      this.doc.setFont(THEME.font, "normal");
      this.doc.setFontSize(size);
      this.color(THEME.muted);
      const lh = size * 1.4;
      for (const ln of this.doc.splitTextToSize(text, this.contentW) as string[]) {
        this.doc.text(ln, this.margin, this.y);
        this.y += lh;
      }
    };
    if (info.headline) {
      renderWrapped(info.headline, 11.5);
    }
    const renderContactLine = (parts: string[]) => {
      const items = parts.filter((d) => d && d.trim());
      if (!items.length) return;
      renderWrapped(items.join("   •   "), 9.5);
    };
    renderContactLine(info.details);
    if (info.links) {
      const linkItems = info.links.filter((d) => d && d.trim());
      if (linkItems.length) {
        const size = 9.5;
        const sep = "   •   ";
        this.doc.setFont(THEME.font, "normal");
        this.doc.setFontSize(size);
        this.color(THEME.muted);
        let x = this.margin;
        linkItems.forEach((link, i) => {
          if (i > 0) {
            this.doc.text(sep, x, this.y);
            x += this.doc.getTextWidth(sep);
          }
          const label = link.replace(/^https?:\/\//, "").replace(/\/+$/, "");
          const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
          const w = this.doc.getTextWidth(label);
          this.doc.textWithLink(label, x, this.y, { url });
          x += w;
        });
        this.y += size * 1.4;
      }
    }
    this.y += 6;
    this.rule();
    this.y += 10;
  }

  /** Hairline divider across the content width. */
  rule(gapBefore = 0) {
    this.y += gapBefore;
    this.breakIfNeeded(2);
    this.doc.setDrawColor(THEME.rule[0], THEME.rule[1], THEME.rule[2]);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.margin, this.y, this.pageW - this.margin, this.y);
  }

  /** Uppercase, letter-spaced section heading with an underline rule. */
  sectionHeading(text: string) {
    this.space(14);
    const size = 10.5;
    this.breakIfNeeded(size * 1.6);
    this.doc.setFont(THEME.font, "bold");
    this.doc.setFontSize(size);
    this.color(THEME.strong);
    this.doc.setCharSpace(1.2);
    this.doc.text(text.toUpperCase(), this.margin, this.y);
    this.doc.setCharSpace(0);
    this.y += 7;
    this.rule();
    this.y += 12;
  }

  /** An experience/education entry header: bold title left, dates right. */
  entryHeader(title: string, dates: string, subtitle?: string) {
    const size = 11;
    this.breakIfNeeded(size * 1.5);
    this.doc.setFont(THEME.font, "bold");
    this.doc.setFontSize(size);
    this.color(THEME.strong);
    this.doc.text(title, this.margin, this.y);
    if (dates) {
      this.doc.setFont(THEME.font, "normal");
      this.doc.setFontSize(9.5);
      this.color(THEME.muted);
      this.doc.text(dates, this.pageW - this.margin, this.y, { align: "right" });
    }
    this.y += size * 1.35;
    if (subtitle) {
      this.doc.setFont(THEME.font, "normal");
      this.doc.setFontSize(10);
      this.color(THEME.ink);
      this.doc.text(subtitle, this.margin, this.y);
      this.y += 10 * 1.4;
    }
  }

  /** Bullet line with a hanging indent. */
  bullet(text: string) {
    const size = 10;
    const indent = 13;
    const lh = size * 1.4;
    this.doc.setFont(THEME.font, "normal");
    this.doc.setFontSize(size);
    this.color(THEME.ink);
    const wrapped = this.doc.splitTextToSize(text, this.contentW - indent) as string[];
    wrapped.forEach((ln, i) => {
      this.breakIfNeeded(lh);
      if (i === 0) this.doc.text("•", this.margin, this.y);
      this.doc.text(ln, this.margin + indent, this.y);
      this.y += lh;
    });
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9 _-]+/g, "").replace(/\s+/g, " ").trim();
}

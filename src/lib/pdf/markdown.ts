// A Markdown document (the candidate profile) as a PDF — headings, bullets and
// paragraphs in the visual language defined in shared.ts.

import type { jsPDF } from "jspdf";
import { PdfBuilder, THEME, documentFileBase, stripMarkdown } from "./shared";

/** Build the PDF document (no download — testable in any runtime). */
export async function buildMarkdownDoc(title: string, markdown: string): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const b = new PdfBuilder(doc);

  b.paragraph(title, { size: 20, style: "bold", color: THEME.strong, gapAfter: 4 });
  b.rule();
  b.space(8);

  let para: string[] = [];
  const flush = () => {
    if (para.length) b.paragraph(stripMarkdown(para.join(" ")), { size: 10.5, gapAfter: 8 });
    para = [];
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^[-*+]\s+(.*)$/) ?? line.match(/^\d+[.)]\s+(.*)$/);
    if (!line || /^---+$/.test(line)) {
      flush();
    } else if (heading) {
      flush();
      if (heading[1].length <= 2) b.sectionHeading(stripMarkdown(heading[2]));
      else b.paragraph(stripMarkdown(heading[2]), { size: 11, style: "bold", color: THEME.strong, gapAfter: 4 });
    } else if (bullet) {
      flush();
      b.bullet(stripMarkdown(bullet[1]));
    } else {
      para.push(line);
    }
  }
  flush();

  return doc;
}

export async function downloadMarkdownPdf(title: string, markdown: string, name?: string | null): Promise<void> {
  const doc = await buildMarkdownDoc(title, markdown);
  doc.save(`${documentFileBase(title, name)}.pdf`);
}

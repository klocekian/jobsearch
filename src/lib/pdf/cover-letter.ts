// Cover letter PDF — shares the visual language defined in shared.ts.
// jsPDF is imported dynamically so it stays out of the initial client bundle.

import type { jsPDF } from "jspdf";
import type { Contact } from "../contact";
import { PdfBuilder, sanitizeFileName } from "./shared";

export interface CoverPdfInput {
  contact: Contact;
  body: string;
  /** Display date, e.g. "June 16, 2026". */
  date: string;
  company?: string;
}

function fileBase(input: CoverPdfInput): string {
  return (
    sanitizeFileName(
      `${input.contact.name ? input.contact.name + " - " : ""}Cover Letter${input.company ? " - " + input.company : ""}`
    ) || "Cover Letter"
  );
}

/** Build the cover-letter PDF document (no download — testable in any runtime). */
export async function buildCoverLetterDoc(input: CoverPdfInput): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const { contact, body, date } = input;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const b = new PdfBuilder(doc);

  // Header: the candidate's NAME (not a section word), then contact line.
  b.header({
    name: contact.name || "Your Name",
    details: [contact.address, contact.phone, contact.email, contact.website],
  });

  if (date) {
    b.paragraph(date, { size: 10, color: [100, 116, 139], gapAfter: 14 });
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  for (const para of paragraphs) {
    b.paragraph(para, { size: 10.5, gapAfter: 11 });
  }

  return doc;
}

export async function downloadCoverLetterPdf(input: CoverPdfInput): Promise<void> {
  const doc = await buildCoverLetterDoc(input);
  doc.save(`${fileBase(input)}.pdf`);
}

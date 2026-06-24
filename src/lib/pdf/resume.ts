// Resume PDF — single-column, standard section headings, standard font: an
// ATS-readable structure rendered in the same visual language as the cover
// letter. jsPDF is imported dynamically.

import type { jsPDF } from "jspdf";
import type { ResumeData } from "../resume/types";
import { PdfBuilder, sanitizeFileName, stripMarkdown } from "./shared";

const md = stripMarkdown;

/** Build the resume PDF document (no download — testable in any runtime). */
export async function buildResumeDoc(data: ResumeData): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const b = new PdfBuilder(doc);

  b.header({
    name: md(data.name) || "Your Name",
    headline: md(data.headline),
    details: [data.location, data.phone, data.email].map(md),
    links: [data.website, data.linkedin, data.github, data.substack].filter(Boolean) as string[],
  });

  if (data.summary.trim()) {
    b.sectionHeading("Summary");
    b.paragraph(md(data.summary.trim()), { size: 10.5 });
  }

  const experience = data.experience.filter(
    (e) => e.role || e.company || e.dates || e.bullets.some((x) => x.trim())
  );
  if (experience.length) {
    b.sectionHeading("Experience");
    experience.forEach((e, i) => {
      if (i > 0) b.space(10);
      const title = [md(e.role), md(e.company)].filter(Boolean).join(", ");
      b.entryHeader(title || "Role", md(e.dates));
      for (const bullet of e.bullets.map((x) => md(x.trim())).filter(Boolean)) {
        b.bullet(bullet);
      }
    });
  }

  for (const section of data.additionalSections ?? []) {
    const items = section.items.map((s) => md(s.trim())).filter(Boolean);
    if (!section.heading.trim() && items.length === 0) continue;
    b.sectionHeading(md(section.heading) || "Additional");
    for (const item of items) b.bullet(item);
  }

  const education = data.education.filter((e) => e.degree || e.school || e.dates);
  if (education.length) {
    b.sectionHeading("Education");
    education.forEach((e, i) => {
      if (i > 0) b.space(8);
      const title = [md(e.degree), md(e.school)].filter(Boolean).join(", ");
      b.entryHeader(title || "Education", md(e.dates));
    });
  }

  if (data.skills.trim()) {
    b.sectionHeading("Skills");
    b.paragraph(md(data.skills.trim()), { size: 10.5 });
  }

  return doc;
}

export async function downloadResumePdf(data: ResumeData, company = ""): Promise<void> {
  const doc = await buildResumeDoc(data);
  const base =
    sanitizeFileName(
      `${data.name ? data.name + " - " : ""}Resume${company.trim() ? " - " + company.trim() : ""}`
    ) || "Resume";
  doc.save(`${base}.pdf`);
}

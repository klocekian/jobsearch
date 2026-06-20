// Builds a single Markdown "application package" bundling the date, the job
// posting link, the (edited) resume, the job posting text, and the cover letter.

import type { ResumeData } from "./resume/types";

export interface PackageInput {
  company: string;
  jobTitle: string;
  jobUrl: string;
  jobText: string;
  /** Structured, edited resume — preferred when available. */
  resume: ResumeData | null;
  /** Raw resume text used when no structured resume has been saved. */
  resumeFallbackText: string;
  coverLetter: string;
  date: string;
}

function resumeToMarkdown(d: ResumeData): string {
  const out: string[] = [];
  out.push(`**${d.name || "Name"}**`);
  if (d.headline.trim()) out.push(`*${d.headline.trim()}*`);
  const contact = [d.location, d.phone, d.email, d.website, d.linkedin]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  if (contact.length) out.push("", contact.join(" · "));

  if (d.summary.trim()) out.push("", "### Summary", "", d.summary.trim());

  const experience = d.experience.filter(
    (e) => e.role || e.company || e.dates || e.bullets.some((b) => b.trim())
  );
  if (experience.length) {
    out.push("", "### Experience");
    for (const e of experience) {
      const title = [e.role, e.company].map((x) => x.trim()).filter(Boolean).join(" — ");
      out.push("", e.dates.trim() ? `**${title || "Role"}** · ${e.dates.trim()}` : `**${title || "Role"}**`);
      for (const b of e.bullets.map((x) => x.trim()).filter(Boolean)) out.push(`- ${b}`);
    }
  }

  const education = d.education.filter((e) => e.degree || e.school || e.dates);
  if (education.length) {
    out.push("", "### Education");
    for (const e of education) {
      const title = [e.degree, e.school].map((x) => x.trim()).filter(Boolean).join(" — ");
      out.push("", e.dates.trim() ? `**${title || "Education"}** · ${e.dates.trim()}` : `**${title || "Education"}**`);
    }
  }

  for (const section of d.additionalSections ?? []) {
    const items = section.items.map((s) => s.trim()).filter(Boolean);
    if (!section.heading.trim() && items.length === 0) continue;
    out.push("", `### ${section.heading || "Additional"}`, "");
    for (const item of items) out.push(`- ${item}`);
  }

  if (d.skills.trim()) out.push("", "### Skills", "", d.skills.trim());

  return out.join("\n");
}

export function buildPackageMarkdown(p: PackageInput): string {
  const role = [p.jobTitle.trim(), p.company.trim()].filter(Boolean).join(" — ");
  const parts: string[] = [];
  parts.push(`# Job Application${role ? ` — ${role}` : ""}`, "");
  parts.push(`**Date:** ${p.date}`);
  if (p.company.trim()) parts.push(`**Company:** ${p.company.trim()}`);
  parts.push(`**Job posting:** ${p.jobUrl.trim() ? p.jobUrl.trim() : "—"}`);

  parts.push("", "---", "", "## Resume", "");
  parts.push(
    p.resume ? resumeToMarkdown(p.resume) : p.resumeFallbackText.trim() || "_No resume provided._"
  );

  parts.push("", "---", "", "## Job Posting", "");
  parts.push(p.jobText.trim() || "_No job posting provided._");

  parts.push("", "---", "", "## Cover Letter", "");
  parts.push(p.coverLetter.trim() || "_No cover letter generated._");

  return parts.join("\n") + "\n";
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9 _-]+/g, "").replace(/\s+/g, " ").trim();
}

export function packageFileName(p: Pick<PackageInput, "company" | "resume">): string {
  const name = p.resume?.name?.trim();
  const base =
    sanitizeFileName(
      `${name ? name + " - " : ""}Application${p.company.trim() ? " - " + p.company.trim() : ""}`
    ) || "Application";
  return `${base}.md`;
}

export function downloadTextFile(filename: string, content: string, mime = "text/markdown;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

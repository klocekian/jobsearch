// Serialize the structured, editable resume back into plain text. Used to feed
// the suggestions model so its quotes are taken from exactly what the user is
// editing — which lets "Apply" locate and replace the quoted text in a field.

import type { ResumeData } from "./types";

export function resumeToText(data: ResumeData): string {
  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  if (data.name) push(data.name);
  if (data.headline) push(data.headline);
  const contact = [data.location, data.email, data.phone, data.linkedin, data.github, data.substack, data.website]
    .filter(Boolean)
    .join(" | ");
  if (contact) push(contact);

  if (data.summary.trim()) {
    push("");
    push("SUMMARY");
    push(data.summary.trim());
  }

  if (data.experience.length > 0) {
    push("");
    push("EXPERIENCE");
    for (const exp of data.experience) {
      const header = [exp.role, exp.company].filter(Boolean).join(", ");
      push([header, exp.dates].filter(Boolean).join(" "));
      for (const bullet of exp.bullets) {
        if (bullet.trim()) push(bullet.trim());
      }
    }
  }

  if (data.education.length > 0) {
    push("");
    push("EDUCATION");
    for (const edu of data.education) {
      push([[edu.degree, edu.school].filter(Boolean).join(", "), edu.dates].filter(Boolean).join(" "));
    }
  }

  if (data.skills.trim()) {
    push("");
    push("SKILLS");
    push(data.skills.trim());
  }

  return lines.join("\n").trim();
}

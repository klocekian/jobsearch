// A read-only view of the fields the existing resume parser recognizes.
// This uses saved text, including text extracted from uploaded PDFs.

import { parseResume } from "./parse";

export function getAtsPreview(resumeText: string) {
  const parsed = parseResume(resumeText);
  const roles = parsed.experience
    .map(({ role, company, dates }) => ({ role, company, dates }))
    .filter((entry) => entry.role || entry.company || entry.dates);
  const skills = parsed.skills.split(",").map((skill) => skill.trim()).filter(Boolean);
  const issues: string[] = [];

  if (!parsed.name) issues.push("Name was not recognized.");
  if (!parsed.email) issues.push("Email was not recognized.");
  if (!parsed.phone) issues.push("Phone was not recognized.");
  if (roles.length === 0) issues.push("No dated roles were recognized.");
  for (const [index, entry] of roles.entries()) {
    if (!entry.role) issues.push(`Role ${index + 1} has no title.`);
    if (!entry.dates) issues.push(`Role ${index + 1} has no dates.`);
  }
  if (skills.length === 0) issues.push("No skills section was recognized.");

  return {
    name: parsed.name,
    contact: {
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      website: parsed.website,
      linkedin: parsed.linkedin,
      github: parsed.github ?? "",
    },
    roles,
    skills,
    issues,
  };
}

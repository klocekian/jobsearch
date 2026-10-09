import type { JobRow } from "./db/jobs";

/** Short date like "Jun 3" — no year, matches the jobs table's Added/Applied columns. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("T") || iso.includes(" ") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The posting's own salary text if it has one, else the parsed range in $k. */
export function formatSalary(job: Pick<JobRow, "salary_text" | "salary_min" | "salary_max">): string {
  if (job.salary_text) return job.salary_text;
  if (job.salary_min && job.salary_max) return `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k`;
  if (job.salary_min) return `$${(job.salary_min / 1000).toFixed(0)}k+`;
  if (job.salary_max) return `Up to $${(job.salary_max / 1000).toFixed(0)}k`;
  return "";
}

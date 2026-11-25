import type { JobRow } from "./db/jobs";
import { analyzeSkills } from "./analysis/skills";
import { TERMINAL_STATUSES, wasSubmitted } from "./status";

export type SearchPhase = "explore" | "prepare" | "applications";
export type ApplicationGroup = "conversation" | "preparing" | "waiting" | "finished";
export const PHASES = [
  { id: "explore", label: "Explore", description: "Find your direction" },
  { id: "prepare", label: "Prepare", description: "Build your story" },
  { id: "applications", label: "Applications", description: "Keep things moving" },
] as const;

export function searchPhase(value: string | null): SearchPhase {
  return value === "prepare" || value === "applications" ? value : "explore";
}

export function isExploring(job: Pick<JobRow, "status">): boolean {
  return job.status === "saved" || job.status === "applying";
}

export function applicationGroup(job: Pick<JobRow, "status" | "previous_status" | "applied_at">): ApplicationGroup | null {
  if (job.status === "applying") return "preparing";
  if (job.status === "accepted" || TERMINAL_STATUSES.has(job.status)) return wasSubmitted(job) ? "finished" : null;
  if (["interview", "interview2", "onsite", "offer"].includes(job.status)) return "conversation";
  return wasSubmitted(job) ? "waiting" : null;
}

export interface SearchPlan { focus: string; learning: string; feedback: string }
export const EMPTY_SEARCH_PLAN: SearchPlan = { focus: "", learning: "", feedback: "" };
export interface SkillPattern { skill: string; jobs: { id: number; title: string; company: string }[] }

/** Counts postings, not repeated keywords. These are text signals, not inferred qualifications. */
export function recurringSkills(jobs: Pick<JobRow, "id" | "title" | "company" | "posting_text">[]): SkillPattern[] {
  const patterns = new Map<string, SkillPattern>();
  for (const job of jobs) {
    const { missingTerms } = analyzeSkills("", job.posting_text);
    for (const skill of new Set(missingTerms)) {
      const pattern = patterns.get(skill) ?? { skill, jobs: [] };
      pattern.jobs.push({ id: job.id, title: job.title, company: job.company });
      patterns.set(skill, pattern);
    }
  }
  return [...patterns.values()].filter((p) => p.jobs.length > 1)
    .sort((a, b) => b.jobs.length - a.jobs.length || a.skill.localeCompare(b.skill)).slice(0, 6);
}

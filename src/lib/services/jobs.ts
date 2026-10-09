import { z } from "zod";
import {
  createJob,
  findMatchingJob,
  listJobs,
  updateJob,
  type JobInsert,
  type JobRow,
  type JobUpdate,
} from "@/lib/db/jobs";
import { getCandidateProfiles } from "@/lib/db/candidate-docs";
import { getDefaultResume } from "@/lib/db/resumes";
import { saveFitnessRun, type AnalysisRunRow } from "@/lib/db/analysis-runs";
import { looksLikeHtml, normalizePostingText } from "@/lib/html-text";
import { STATUS_OPTIONS } from "@/lib/status";
import { checkJobStatus, type JobCheckResult } from "@/lib/job-status-check";
import { evaluateFitnessDeterministic } from "@/lib/fitness/deterministic";
import { FitnessResultSchema, type FitnessResult } from "@/lib/fitness/schema";
import { FITNESS_SYSTEM_PROMPT, buildFitnessUserMessage } from "@/lib/fitness/prompt";
import { generateStructured } from "@/lib/ai";

// The job rules both front doors share: the API routes (the app and the
// extension) and the MCP tools. Callers load the job with the user's id first
// (getJob / requireJob) — functions here take a JobRow, so ownership is settled
// before any of them run.

// ── Statuses ────────────────────────────────────────────────────────────────

export const STATUS_VALUES = STATUS_OPTIONS.map((s) => s.value) as [string, ...string[]];

/** Closing statuses. Entering one remembers the live status it left, so the job can be restored. */
export const TERMINAL_STATUSES = new Set(["rejected", "declined", "withdrawn", "abandoned", "closed"]);

/** Still in play: worth checking whether the posting is up, counted as active in summaries. */
export const ACTIVE_STATUSES = new Set(["saved", "applying", "applied", "interview", "interview2", "onsite", "offer"]);

/**
 * Fields that ride along with a status change: moving to "applied" stamps
 * applied_at (unless the caller supplied one), and moving into a terminal
 * status remembers the live status it left so the job can be restored later.
 */
export function statusChangeUpdates(
  next: string,
  currentStatus: string | undefined,
  opts?: { appliedAtGiven?: boolean },
): JobUpdate {
  const updates: JobUpdate = {};
  if (next === "applied" && !opts?.appliedAtGiven) {
    updates.applied_at = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  }
  if (TERMINAL_STATUSES.has(next)) {
    if (currentStatus && !TERMINAL_STATUSES.has(currentStatus)) updates.previous_status = currentStatus;
  } else {
    updates.previous_status = null;
  }
  return updates;
}

// ── Validation ──────────────────────────────────────────────────────────────

/** The fields a person or a model may set on a job. Reports and scores are written by analysis runs, not here. */
export const JobFieldsSchema = z.object({
  company: z.string().max(500),
  title: z.string().max(500),
  url: z.string().max(2000),
  location: z.string().max(500),
  remote_type: z.string().max(50).describe("e.g. remote, hybrid, onsite"),
  salary_text: z.string().max(500),
  salary_min: z.number().int().nullable(),
  salary_max: z.number().int().nullable(),
  status: z.enum(STATUS_VALUES),
  posting_text: z.string().describe("The full job description. Needed for ATS match and fitness checks."),
  notes: z.string(),
  applied_at: z.string().max(50).nullable().describe("YYYY-MM-DD"),
}).partial();

export type JobFields = z.infer<typeof JobFieldsSchema>;

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ── Create, merge, edit ─────────────────────────────────────────────────────

/**
 * Add a job, or fold the details into the one already tracked under the same
 * URL or company + title. Every capture path lands here, so posting text is
 * normalized once — the extension, fetch-job and extract can each let rich-text
 * markup through.
 */
export async function addJob(
  userId: number | null,
  fields: JobFields & { source?: string },
): Promise<{ job: JobRow; merged: boolean }> {
  const insert: JobInsert = { ...definedOnly(fields), user_id: userId };
  if (insert.posting_text) insert.posting_text = normalizePostingText(insert.posting_text);
  if (insert.status) Object.assign(insert, statusChangeUpdates(insert.status, undefined, { appliedAtGiven: !!insert.applied_at }));

  const existing = await findMatchingJob(userId, fields);
  if (existing) return { job: await mergeInto(existing, insert), merged: true };
  return { job: await createJob(insert), merged: false };
}

/** Fill gaps in a tracked job from a fresh capture, keeping whichever value is more complete. */
async function mergeInto(existing: JobRow, incoming: JobInsert): Promise<JobRow> {
  const updates: Record<string, unknown> = {};
  const mergeable: (keyof JobInsert)[] = [
    "location", "remote_type", "salary_text", "salary_min", "salary_max",
    "posting_text", "url",
  ];
  for (const key of mergeable) {
    const newVal = incoming[key];
    if (!newVal) continue;
    const oldVal = existing[key as keyof JobRow];

    // posting_text is judged on quality, not just length. Incoming text is
    // normalized on write, so a clean capture is usually SHORTER than a stored
    // one full of markup — under the longer-wins rule below, re-clipping could
    // never repair a job whose text came in as HTML.
    if (key === "posting_text" && typeof oldVal === "string" && looksLikeHtml(oldVal)) {
      updates[key] = newVal;
      continue;
    }
    if (!oldVal || (typeof oldVal === "string" && oldVal.length < (newVal as string).length)) {
      updates[key] = newVal;
    }
  }
  if (Object.keys(updates).length === 0) return existing;
  return (await updateJob(existing.id, updates))!;
}

/**
 * Apply an edit with the status rules. `append_note` adds a dated line instead
 * of replacing the notes. Returns null when there was nothing to change.
 */
export async function editJob(
  job: JobRow,
  changes: JobFields & { is_starred?: number; append_note?: string },
): Promise<JobRow | null> {
  const { append_note, ...fields } = changes;
  const updates: JobUpdate = definedOnly(fields);
  if (typeof updates.posting_text === "string") updates.posting_text = normalizePostingText(updates.posting_text);
  if (append_note) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const base = (updates.notes ?? job.notes).trimEnd();
    updates.notes = `${base}${base ? "\n\n" : ""}[${today}] ${append_note.trim()}`;
  }
  if (fields.status) {
    Object.assign(updates, statusChangeUpdates(fields.status, job.status, { appliedAtGiven: !!fields.applied_at }));
  }
  if (Object.keys(updates).length === 0) return null;
  return (await updateJob(job.id, updates)) ?? null;
}

// ── Posting checks ──────────────────────────────────────────────────────────

/**
 * Check whether the job's posting is still up. An active job whose posting is
 * gone moves to "closed", remembering its status so "undo" can restore it.
 */
export async function checkAndCloseJob(job: JobRow): Promise<{ result: JobCheckResult; closed: boolean }> {
  const result = await checkJobStatus(job);
  const closed = result.status === "closed" && ACTIVE_STATUSES.has(job.status);
  if (closed) await updateJob(job.id, { status: "closed", previous_status: job.status });
  return { result, closed };
}

/** Check the user's most recent active jobs that have a URL — 5 at a time, so a big list doesn't flood connections. */
export async function checkActiveJobs(
  userId: number | null,
  limit = 50,
): Promise<{ job: JobRow; result: JobCheckResult; closed: boolean }[]> {
  const jobs = await listJobs(userId, { sort: "created_at", order: "desc" });
  const toCheck = jobs.filter((j) => j.url && ACTIVE_STATUSES.has(j.status)).slice(0, limit);
  const checked: { job: JobRow; result: JobCheckResult; closed: boolean }[] = [];
  const CHUNK_SIZE = 5;
  for (let i = 0; i < toCheck.length; i += CHUNK_SIZE) {
    const chunk = toCheck.slice(i, i + CHUNK_SIZE);
    checked.push(...(await Promise.all(chunk.map(async (job) => ({ job, ...(await checkAndCloseJob(job)) })))));
  }
  return checked;
}

// ── Fitness ─────────────────────────────────────────────────────────────────

/** The AI check grades against both candidate documents; without either it would score half a picture. */
export class MissingCandidateDocsError extends Error {
  constructor(readonly missing: string[]) {
    super(`The fitness check needs the candidate's ${missing.join(" and ")}.`);
  }
}

/** Both candidate documents, or MissingCandidateDocsError naming what's absent. */
export async function requireCandidateDocs(userId: number | null): Promise<{ profile: string; gaps: string }> {
  const docs = await getCandidateProfiles(userId);
  const missing = [!docs.profile && "positive profile", !docs.gaps && "negative profile (gaps)"].filter(
    (m): m is string => !!m,
  );
  if (missing.length) throw new MissingCandidateDocsError(missing);
  return docs;
}

/**
 * Fill the header fields a report left blank from the job itself. The schema
 * defaults a missing location/salary to its placeholder, so those count as blank.
 */
export function completeFitnessResult(raw: FitnessResult, job: JobRow): FitnessResult {
  const given = (value: string, placeholder: string) => (value && value !== placeholder ? value : "");
  return {
    ...raw,
    company: raw.company || job.company || "Unknown Company",
    title: raw.title || job.title || "Job Opportunity",
    location: given(raw.location, "Not specified") || job.location || "Not specified",
    salary: given(raw.salary, "Not stated") || job.salary_text || "Not stated",
  };
}

type FitnessRun = { result: FitnessResult; model: string; run: AnalysisRunRow; job: JobRow | undefined };

function postingOf(job: JobRow): string {
  const posting = (job.posting_text ?? "").trim();
  if (!posting) throw new Error("This job has no posting text.");
  return posting;
}

/** Fast rule-based check. Saved here rather than by the caller, so a run is never lost to a closed tab. */
export async function runRuleBasedFitness(userId: number | null, job: JobRow): Promise<FitnessRun> {
  const posting = postingOf(job);
  const [{ profile, gaps }, resume] = await Promise.all([getCandidateProfiles(userId), getDefaultResume(userId)]);
  const result = evaluateFitnessDeterministic({
    company: job.company || "Unknown Company",
    title: job.title || "Job Opportunity",
    location: job.location || "",
    salary: job.salary_text || "",
    posting,
    profile,
    gaps,
    resumeText: resume?.content,
  });
  const model = "deterministic:rule-based";
  return { result, model, ...(await saveFitnessRun(job, result, model)) };
}

/** The full reasoned check with the user's AI provider. Throws MissingCandidateDocsError first if it can't be grounded. */
export async function runAiFitness(userId: number | null, job: JobRow): Promise<FitnessRun> {
  const posting = postingOf(job);
  const { profile, gaps } = await requireCandidateDocs(userId);
  const { data, model, provider } = await generateStructured({
    system: FITNESS_SYSTEM_PROMPT,
    prompt: buildFitnessUserMessage({ profile, gaps, posting }),
    schema: FitnessResultSchema,
    schemaName: "FitnessResult",
    // The report is long and the model reasons through every requirement.
    maxTokens: 8192,
  });
  const result = completeFitnessResult(data, job);
  const label = `${provider}:${model}`;
  return { result, model: label, ...(await saveFitnessRun(job, result, label)) };
}

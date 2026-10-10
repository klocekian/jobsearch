import { z } from "zod";
import { TERMINAL_STATUSES, statusLabel } from "./status";

/**
 * The at-a-glance activity banner at the top of a job: where it stands, what's
 * coming up, what happened last, and what to do next.
 *
 * Two sources, in order of preference:
 *  1. A stored summary — written by an MCP client (update_job_summary) or by
 *     the app's own AI provider. It is pinned to a fingerprint of the notes and
 *     status it was written from, so a later note or status change marks it
 *     stale instead of letting it silently drift.
 *  2. A derived summary — parsed from the dated notes entries and the signals
 *     already on the job (status, applied date, scores, submissions). Always
 *     available, never wrong about the stage, but only as good as the notes.
 */

export const ActivityEventSchema = z.object({
  what: z.string().describe("Short label, e.g. 'Recruiter screen with Becky Diaz'.").default(""),
  when: z
    .string()
    .describe("Wall-clock date or date-time as stated, no offset: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'.")
    .default(""),
  timezone: z.string().describe("Timezone abbreviation as stated, e.g. 'PT'. Empty if unknown.").default(""),
  details: z.string().describe("One short line: format, length, link or logistics. Empty if none.").default(""),
});

export const JobActivitySchema = z.object({
  headline: z.string().describe("One sentence on where this application stands right now.").default(""),
  upcoming: z.array(ActivityEventSchema).describe("Scheduled future events, soonest first. Empty if none.").default([]),
  latest: z
    .object({
      date: z.string().describe("YYYY-MM-DD of the most recent interaction.").default(""),
      summary: z.string().describe("One or two sentences: what happened and anything learned.").default(""),
    })
    .nullable()
    .describe("The most recent interaction with the company (interview, call, email). Null if none yet.")
    .default(null),
  next_steps: z.array(z.string()).describe("Up to 4 concrete next actions for the candidate, most urgent first.").default([]),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type JobActivity = z.infer<typeof JobActivitySchema>;

export interface StoredJobActivity extends JobActivity {
  source: "mcp" | "ai";
  written_at: string;
  /** notesFingerprint() of the job when this was written. */
  fingerprint: string;
}

export type ResolvedJobActivity = JobActivity & {
  source: "mcp" | "ai" | "derived";
  written_at?: string;
  /** A stored summary exists but the notes or status changed after it was written. */
  stale: boolean;
};

interface JobLike {
  status: string;
  previous_status: string | null;
  notes: string;
  created_at: string;
  applied_at: string | null;
  posting_text?: string;
  match_score: number | null;
  fitness_score: number | null;
  activity_summary?: string | null;
}

interface SubmissionLike {
  type: string;
}

/** Stable short hash of what a summary is written from — notes and status. */
export function notesFingerprint(job: Pick<JobLike, "notes" | "status">): string {
  const s = `${job.status}\n${(job.notes ?? "").trim()}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function parseStoredActivity(raw: string | null | undefined): StoredJobActivity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredJobActivity;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeActivity(
  activity: JobActivity,
  job: Pick<JobLike, "notes" | "status">,
  source: StoredJobActivity["source"],
): string {
  const stored: StoredJobActivity = {
    ...JobActivitySchema.parse(activity),
    source,
    written_at: new Date().toISOString(),
    fingerprint: notesFingerprint(job),
  };
  return JSON.stringify(stored);
}

// ── Dates ──────────────────────────────────────────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm' as local wall-clock time. */
function parseWallClock(when: string): Date | null {
  const m = when.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return isNaN(d.getTime()) ? null : d;
}

function dayDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "today", "tomorrow", "in 6 days", "yesterday", "3 days ago". */
export function relativeDay(when: string, now = new Date()): string {
  const d = parseWallClock(when);
  if (!d) return "";
  const n = dayDiff(now, d);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** "Thu, Oct 15 · 9:30 AM PT" — or just the date when no time is known. */
export function formatEventWhen(event: Pick<ActivityEvent, "when" | "timezone">): string {
  const d = parseWallClock(event.when);
  if (!d) return event.when;
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!/T\d{2}:\d{2}/.test(event.when)) return date;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}${event.timezone ? ` ${event.timezone}` : ""}`;
}

/** Events that haven't happened yet (today counts), soonest first. */
export function futureEvents(events: ActivityEvent[], now = new Date()): ActivityEvent[] {
  return events
    .filter((e) => {
      const d = parseWallClock(e.when);
      return d && dayDiff(now, d) >= 0;
    })
    .sort((a, b) => a.when.localeCompare(b.when));
}

// ── Notes parsing ──────────────────────────────────────────────────────────

export interface NoteEntry {
  /** YYYY-MM-DD, or "" for text before the first dated entry. */
  date: string;
  text: string;
}

/** Split notes into `[YYYY-MM-DD] …` entries — the format update_job's append_note writes. */
export function parseNoteEntries(notes: string): NoteEntry[] {
  const entries: NoteEntry[] = [];
  const re = /^\s*\[(\d{4}-\d{2}-\d{2})\]\s*/gm;
  let last: { date: string; start: number } | null = null;
  let m: RegExpExecArray | null;
  const preambleEnd = notes.search(re);
  re.lastIndex = 0;
  const pre = (preambleEnd === -1 ? notes : notes.slice(0, preambleEnd)).trim();
  if (pre) entries.push({ date: "", text: pre });
  while ((m = re.exec(notes))) {
    if (last) entries.push({ date: last.date, text: notes.slice(last.start, m.index).trim() });
    last = { date: m[1], start: m.index + m[0].length };
  }
  if (last) entries.push({ date: last.date, text: notes.slice(last.start).trim() });
  return entries.filter((e) => e.text);
}

const EVENT_RE =
  /\b(recruiter screen|phone screen|video screen|technical screen|technical interview|hiring manager (?:interview|screen|call|chat)|panel interview|final interview|final round|portfolio review|design review|case study|presentation|onsite|on-site|interview|screen|call|meeting|chat)\b/i;
const MONTH_DATE_RE =
  /\b(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?:,?\s+(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?)?(?:\s*(?:to|-|–)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\s*\b(PT|PST|PDT|ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|UTC|GMT)?\b/gi;
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?\b/g;

function sentenceAround(text: string, index: number): string {
  const before = text.slice(0, index);
  const start = Math.max(before.lastIndexOf(". "), before.lastIndexOf("\n")) + 1;
  const afterIdx = text.slice(index).search(/\.\s|\n|$/);
  return text.slice(start, index + afterIdx + 1).trim();
}

function eventLabel(sentence: string): string {
  const kind = sentence.match(EVENT_RE)?.[1];
  if (!kind) return "";
  const label = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  const who = sentence.match(/\bwith\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)/)?.[1];
  return who ? `${label} with ${who}` : label;
}

function to24h(hour: number, ampm: string | undefined): number {
  const pm = ampm?.toLowerCase().startsWith("p");
  const am = ampm?.toLowerCase().startsWith("a");
  if (pm && hour < 12) return hour + 12;
  if (am && hour === 12) return 0;
  // No meridiem: assume business hours (1–7 means afternoon).
  if (!ampm && hour >= 1 && hour <= 7) return hour + 12;
  return hour;
}

/** Find scheduled events mentioned in an entry: a date close to an interview/screen/call word. */
function eventsInEntry(entry: NoteEntry, fallbackYear: number): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const baseYear = entry.date ? Number(entry.date.slice(0, 4)) : fallbackYear;
  const consider = (index: number, when: string, timezone: string) => {
    const sentence = sentenceAround(entry.text, index);
    const what = eventLabel(sentence);
    if (!what) return;
    events.push({ what, when, timezone, details: sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence });
  };

  for (const m of entry.text.matchAll(MONTH_DATE_RE)) {
    const month = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
    const day = Number(m[2]);
    let year = m[3] ? Number(m[3]) : baseYear;
    // "Jan 5" written in December means next January.
    if (!m[3] && entry.date) {
      const written = parseWallClock(entry.date)!;
      if (new Date(year, month, day).getTime() < written.getTime() - 30 * 86_400_000) year += 1;
    }
    let when = `${year}-${pad(month + 1)}-${pad(day)}`;
    if (m[4]) when += `T${pad(to24h(Number(m[4]), m[6]))}:${pad(Number(m[5] ?? 0))}`;
    consider(m.index, when, m[7]?.toUpperCase() ?? "");
  }
  for (const m of entry.text.matchAll(ISO_DATE_RE)) {
    const when = m[4] ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`;
    consider(m.index, when, "");
  }
  return events;
}

// ── Derived summary ────────────────────────────────────────────────────────

const INTERVIEW_STATUSES = new Set(["interview", "interview2", "onsite"]);

function daysSince(dateText: string | null, now: Date): number | null {
  if (!dateText) return null;
  const d = parseWallClock(dateText.replace(" ", "T"));
  return d ? dayDiff(d, now) : null;
}

function shortDate(dateText: string): string {
  const d = parseWallClock(dateText.replace(" ", "T"));
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : dateText;
}

function firstSentences(text: string, max = 240): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > 80 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

export function deriveJobActivity(job: JobLike, submissions: SubmissionLike[], now = new Date()): JobActivity {
  const entries = parseNoteEntries(job.notes ?? "");
  const dated = entries.filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const lastEntry = dated[dated.length - 1] ?? entries[entries.length - 1] ?? null;

  const upcoming = futureEvents(
    entries.flatMap((e) => eventsInEntry(e, now.getFullYear())),
    now,
  ).filter((e, i, all) => all.findIndex((o) => o.when.slice(0, 10) === e.when.slice(0, 10)) === i);
  const next = upcoming[0];

  const status = job.status;
  const stage = statusLabel(status);
  const appliedDays = daysSince(job.applied_at, now);
  const lastNoteDays = lastEntry?.date ? daysSince(lastEntry.date, now) : null;
  const hasSubmission = submissions.length > 0;
  const hasCover = submissions.some((s) => s.type === "cover_letter" || s.type === "package");

  // Headline
  let headline: string;
  if (next) {
    headline = `${next.what} ${relativeDay(next.when, now)}.`;
  } else if (TERMINAL_STATUSES.has(status)) {
    headline = job.previous_status
      ? `${stage} after reaching ${statusLabel(job.previous_status)}.`
      : `${stage}.`;
  } else if (status === "saved") {
    headline = `Saved ${shortDate(job.created_at)} — not applied yet.`;
  } else if (status === "applying") {
    headline = "Application in progress — not submitted yet.";
  } else if (status === "applied") {
    headline =
      appliedDays != null
        ? `Applied ${shortDate(job.applied_at!)} (${appliedDays === 0 ? "today" : `${appliedDays} day${appliedDays === 1 ? "" : "s"} ago`}) — ${lastEntry?.date && job.applied_at && lastEntry.date > job.applied_at.slice(0, 10) ? "see latest note" : "no response logged yet"}.`
        : "Applied — no response logged yet.";
  } else if (INTERVIEW_STATUSES.has(status)) {
    headline = lastEntry?.date
      ? `Nothing scheduled — last activity ${shortDate(lastEntry.date)}.`
      : "Nothing scheduled in the notes.";
  } else if (status === "offer") {
    headline = "Offer stage.";
  } else if (status === "accepted") {
    headline = "Offer accepted.";
  } else {
    headline = `${stage}.`;
  }

  // Next steps
  const steps: string[] = [];
  if (next) steps.push(`Prepare for the ${next.what.charAt(0).toLowerCase()}${next.what.slice(1)} (${formatEventWhen(next)}).`);
  if (status === "saved" || status === "applying") {
    if (!job.posting_text?.trim()) steps.push("Paste the job posting so it can be scored.");
    if (job.fitness_score == null) steps.push("Run the profile fitness check.");
    if (job.match_score == null) steps.push("Score your resume against the posting.");
    else if (job.match_score < 90) steps.push(`Tune your resume to 90+ (currently ${job.match_score}).`);
    if (status === "applying" && !hasCover) steps.push("Draft the cover letter.");
    steps.push(status === "saved" ? "Apply." : "Submit the application and mark it Applied.");
  } else if (status === "applied") {
    if (!hasSubmission) steps.push("Save the resume and cover letter you sent under Submission.");
    if (appliedDays != null && appliedDays >= 7 && !(lastNoteDays != null && lastNoteDays < 7)) {
      steps.push(`Follow up — it's been ${appliedDays} days since you applied.`);
    } else {
      steps.push("Wait for a response; follow up after a week.");
    }
  } else if (INTERVIEW_STATUSES.has(status) && !next) {
    if (lastNoteDays != null && lastNoteDays <= 2) steps.push("Send a thank-you note if you haven't.");
    steps.push("Log the next step in notes once it's scheduled.");
    if (lastNoteDays != null && lastNoteDays >= 7) steps.push(`Follow up — last activity ${lastNoteDays} days ago.`);
  } else if (status === "offer") {
    steps.push("Review the offer and decide whether to negotiate.");
  }

  return {
    headline,
    upcoming,
    latest: lastEntry ? { date: lastEntry.date, summary: firstSentences(lastEntry.text) } : null,
    next_steps: steps.slice(0, 4),
  };
}

/** The banner's content: the stored summary when it's current, otherwise derived from notes and signals. */
export function resolveJobActivity(job: JobLike, submissions: SubmissionLike[], now = new Date()): ResolvedJobActivity {
  const stored = parseStoredActivity(job.activity_summary);
  if (stored && stored.fingerprint === notesFingerprint(job)) {
    return { ...stored, upcoming: futureEvents(stored.upcoming ?? [], now), source: stored.source, stale: false };
  }
  return { ...deriveJobActivity(job, submissions, now), source: "derived", written_at: stored?.written_at, stale: !!stored };
}

// ── Prompt for AI-written summaries ────────────────────────────────────────

export const ACTIVITY_SYSTEM_PROMPT = `You maintain the status banner for one job application in a job search tracker.
From the job's status, dates and the candidate's notes, write a brief, factual summary.

Rules:
- Use only what the notes and fields say. Never invent names, dates, or outcomes.
- "upcoming" lists only events scheduled after today, with the date/time exactly as stated in the notes (wall-clock, no conversion).
- "latest" is the most recent interaction with the company, not a note about the candidate's own prep.
- "next_steps" are concrete actions for the candidate (prepare X, follow up with Y, send Z), most urgent first, at most 4.
- Plain sentences, no markdown, no filler.`;

export function buildActivityPrompt(
  job: JobLike & { company: string; title: string },
  submissions: { type: string; label: string; created_at: string }[],
): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const lines = [
    `Today: ${today}`,
    `Job: ${job.title || "Untitled"} at ${job.company || "Unknown company"}`,
    `Stage: ${statusLabel(job.status)}${job.previous_status ? ` (previously ${statusLabel(job.previous_status)})` : ""}`,
    `Saved: ${job.created_at.slice(0, 10)}`,
    `Applied: ${job.applied_at ? job.applied_at.slice(0, 10) : "not yet"}`,
    `Profile fitness: ${job.fitness_score != null ? `${job.fitness_score}/10` : "not run"}`,
    `Resume ATS match: ${job.match_score != null ? `${job.match_score}/100` : "not run"}`,
    `Saved submissions: ${submissions.length ? submissions.map((s) => `${s.label || s.type} (${s.created_at.slice(0, 10)})`).join("; ") : "none"}`,
    "",
    "Notes:",
    job.notes?.trim() || "(none)",
  ];
  return lines.join("\n");
}

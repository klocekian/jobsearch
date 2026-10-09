import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  findMatchingJob,
  mergeJob,
  statusChangeUpdates,
  type JobInsert,
  type JobRow,
  type JobUpdate,
} from "@/lib/db/jobs";
import { listResumes, createResume, addResumeTag, type ResumeRow } from "@/lib/db/resumes";
import { getCandidateProfiles, upsertCandidateDoc } from "@/lib/db/candidate-docs";
import { listSubmissions, createSubmission } from "@/lib/db/submissions";
import { getProfileData } from "@/lib/db/users";
import { normalizePostingText } from "@/lib/html-text";
import { analyze } from "@/lib/analysis/analyze";
import type { MatchReport } from "@/lib/analysis/types";
import { evaluateFitnessDeterministic } from "@/lib/fitness/deterministic";
import { FitnessResultSchema, type FitnessResult } from "@/lib/fitness/schema";
import { FITNESS_SYSTEM_PROMPT, buildFitnessUserMessage } from "@/lib/fitness/prompt";
import { renderFitnessText } from "@/lib/fitness/render";
import { checkJobStatus } from "@/lib/job-status-check";
import { STATUS_OPTIONS } from "@/lib/status";
import { saveFitnessRun, saveMatchRun } from "@/lib/db/analysis-runs";
import { JobActivitySchema, resolveJobActivity, serializeActivity } from "@/lib/job-activity";

// MCP surface over the job tracker. Every tool is scoped to one user, resolved
// once by the transport entry point — the same scoping the API routes get from
// the session cookie.
//
// AI features are deliberately not proxied through the app's own providers:
// the MCP client is already a model. For the AI fitness check, the server hands
// over the exact prompt the app uses (get_fitness_brief) and validates what
// comes back (save_fitness_report), so a report written from Claude reads the
// same as one written from the app.

const STATUS_VALUES = STATUS_OPTIONS.map((s) => s.value) as [string, ...string[]];
const ACTIVE_STATUSES = new Set(["saved", "applying", "applied", "interview", "interview2", "onsite", "offer"]);

const SORT_KEYS = [
  "company", "title", "status", "salary_min", "salary_max", "location",
  "match_score", "fitness_score", "created_at", "updated_at", "applied_at",
] as const;

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** The list view of a job: everything a model needs to pick one, nothing it has to wade through. */
function jobSummary(j: JobRow) {
  return {
    id: j.id,
    company: j.company,
    title: j.title,
    status: j.status,
    starred: !!j.is_starred,
    location: j.location || undefined,
    remote_type: j.remote_type || undefined,
    salary: j.salary_text || undefined,
    ats_match: j.match_score ?? undefined,
    fitness: j.fitness_score ?? undefined,
    url: j.url || undefined,
    applied_at: j.applied_at ?? undefined,
    updated_at: j.updated_at,
  };
}

function resumeSummary(r: ResumeRow) {
  return {
    id: r.id,
    name: r.name,
    is_default: !!r.is_default,
    tags: safeJson<string[]>(r.tags, []),
    chars: r.content.length,
    updated_at: r.updated_at,
  };
}

function safeJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try { return JSON.parse(text) as T; } catch { return fallback; }
}

/** The actionable slice of a match report — the full report is mostly pass rows. */
function matchDigest(report: MatchReport) {
  return {
    score: report.score,
    hard_skills: {
      matched: report.hardSkills.matched,
      missing: report.hardSkills.rows.filter((r) => r.state === "missing").map((r) => r.skill),
    },
    soft_skills: {
      matched: report.softSkills.matched,
      missing: report.softSkills.rows.filter((r) => r.state === "missing").map((r) => r.skill),
    },
    searchability_issues: report.searchability.flatMap((g) =>
      g.items.filter((i) => i.status !== "pass").map((i) => `${g.label}: ${i.message}`),
    ),
    recruiter_issues: report.recruiterTips
      .filter((t) => t.status !== "pass")
      .map((t) => `${t.label}: ${t.message}`),
    ai_detection: { confidence: report.aiDetection.confidence, band: report.aiDetection.band },
  };
}

export function createJobsearchMcpServer(
  userId: number | null,
  info?: Omit<Implementation, "name" | "version">,
): McpServer {
  const server = new McpServer(
    { name: "jobsearch", version: "0.1.0", ...info },
    {
      instructions:
        "The user's job search tracker: jobs and their pipeline status, resumes, the candidate profile and gaps documents, and ATS match / fitness scoring. Start with pipeline_summary. Read get_candidate_profile before writing anything on the candidate's behalf, and never claim experience it doesn't support.",
    },
  );

  async function requireJob(jobId: number): Promise<JobRow> {
    const job = await getJob(jobId, userId);
    if (!job) throw new Error(`Job ${jobId} not found.`);
    return job;
  }

  /** The requested resume, or the default (falling back to most recently updated). */
  async function pickResume(resumeId?: number): Promise<ResumeRow> {
    const resumes = await listResumes(userId);
    const resume = resumeId != null ? resumes.find((r) => r.id === resumeId) : resumes[0];
    if (!resume) throw new Error(resumeId != null ? `Resume ${resumeId} not found.` : "No resumes saved yet.");
    return resume;
  }

  /** Wrap a handler so thrown errors come back as tool errors the model can read, not protocol failures. */
  function safe<A>(fn: (args: A) => Promise<ReturnType<typeof json>>) {
    return async (args: A) => {
      try {
        return await fn(args);
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    };
  }

  // ── Pipeline ────────────────────────────────────────────────────────────

  server.registerTool(
    "pipeline_summary",
    {
      title: "Pipeline summary",
      description:
        "Overview of the job search: job counts per status, starred jobs, and the strongest fitness targets not yet applied to. Start here.",
      annotations: { readOnlyHint: true },
    },
    safe(async () => {
      const jobs = await listJobs(userId, { sort: "updated_at", order: "desc" });
      const byStatus: Record<string, number> = {};
      for (const j of jobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
      const notYetApplied = jobs.filter((j) => j.status === "saved" || j.status === "applying");
      return json({
        total: jobs.length,
        active: jobs.filter((j) => ACTIVE_STATUSES.has(j.status)).length,
        by_status: STATUS_OPTIONS.filter((s) => byStatus[s.value]).map((s) => ({
          status: s.value,
          label: s.label,
          count: byStatus[s.value],
        })),
        starred: jobs.filter((j) => j.is_starred).map(jobSummary),
        top_unapplied_by_fitness: notYetApplied
          .filter((j) => j.fitness_score != null)
          .sort((a, b) => (b.fitness_score ?? 0) - (a.fitness_score ?? 0))
          .slice(0, 10)
          .map(jobSummary),
        recently_updated: jobs.slice(0, 10).map(jobSummary),
      });
    }),
  );

  server.registerTool(
    "list_jobs",
    {
      title: "List jobs",
      description: "List tracked jobs, optionally filtered by status, a search term (company/title/location), or starred.",
      inputSchema: {
        status: z.enum(STATUS_VALUES).optional(),
        search: z.string().optional().describe("Matches company, title, or location (case-insensitive)."),
        starred: z.boolean().optional(),
        sort: z.enum(SORT_KEYS).optional().describe("Defaults to created_at."),
        order: z.enum(["asc", "desc"]).optional().describe("Defaults to desc."),
        limit: z.number().int().min(1).max(500).optional().describe("Defaults to 50."),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ status, search, starred, sort, order, limit }) => {
      const jobs = await listJobs(userId, { status, search, starred, sort, order });
      const max = limit ?? 50;
      return json({ total: jobs.length, returned: Math.min(max, jobs.length), jobs: jobs.slice(0, max).map(jobSummary) });
    }),
  );

  server.registerTool(
    "get_job",
    {
      title: "Get job",
      description: "Full detail for one job: posting text, notes, saved submissions, and optionally the stored ATS match and fitness reports.",
      inputSchema: {
        job_id: z.number().int(),
        include_posting: z.boolean().optional().describe("Include the full posting text. Defaults to true."),
        include_reports: z.boolean().optional().describe("Include stored ATS match digest and fitness report. Defaults to false."),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ job_id, include_posting, include_reports }) => {
      const job = await requireJob(job_id);
      const submissions = await listSubmissions(job.id);
      const matchReport = include_reports ? safeJson<MatchReport | null>(job.match_report, null) : null;
      const fitnessReport = include_reports ? safeJson<FitnessResult | null>(job.fitness_report, null) : null;
      return json({
        ...jobSummary(job),
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        source: job.source,
        previous_status: job.previous_status,
        created_at: job.created_at,
        notes: job.notes,
        posting_text: include_posting === false ? undefined : job.posting_text,
        ats_match_resume: job.match_resume_name ?? undefined,
        ats_match_report: matchReport ? matchDigest(matchReport) : undefined,
        fitness_run_at: job.fitness_run_at ?? undefined,
        fitness_report: fitnessReport ? renderFitnessText(fitnessReport) : undefined,
        activity_summary: resolveJobActivity(job, submissions),
        submissions: submissions.map((s) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          format: s.format,
          created_at: s.created_at,
          content: s.file_path ? undefined : s.content,
        })),
      });
    }),
  );

  server.registerTool(
    "add_job",
    {
      title: "Add job",
      description:
        "Add a job to the tracker. If one with the same URL, or the same company + title, already exists, the new details are merged into it instead of creating a duplicate.",
      inputSchema: {
        company: z.string().max(500),
        title: z.string().max(500),
        url: z.string().max(2000).optional(),
        location: z.string().max(500).optional(),
        remote_type: z.string().max(50).optional().describe("e.g. remote, hybrid, onsite"),
        salary_text: z.string().max(500).optional(),
        salary_min: z.number().int().optional(),
        salary_max: z.number().int().optional(),
        status: z.enum(STATUS_VALUES).optional().describe("Defaults to saved."),
        posting_text: z.string().optional().describe("The full job description. Needed for ATS match and fitness checks."),
        notes: z.string().optional(),
      },
    },
    safe(async (args) => {
      const insert: JobInsert = { source: "mcp", user_id: userId };
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) (insert as Record<string, unknown>)[k] = v;
      }
      if (insert.posting_text) insert.posting_text = normalizePostingText(insert.posting_text);
      if (insert.status) Object.assign(insert, statusChangeUpdates(insert.status, undefined));

      const existing = await findMatchingJob(userId, args);
      if (existing) {
        const job = await mergeJob(existing, insert);
        return json({ merged: true, job: jobSummary(job) });
      }
      const job = await createJob(insert);
      return json({ merged: false, job: jobSummary(job) });
    }),
  );

  server.registerTool(
    "update_job",
    {
      title: "Update job",
      description:
        "Update fields on a job. Changing status follows the app's rules: 'applied' stamps applied_at, and closing statuses remember the prior status so it can be restored. Use append_note to add a dated line to the notes without replacing them. After logging activity (an interview booked or held, a reply, an offer), call update_job_summary so the job's banner in the app reflects it.",
      inputSchema: {
        job_id: z.number().int(),
        status: z.enum(STATUS_VALUES).optional(),
        starred: z.boolean().optional(),
        company: z.string().max(500).optional(),
        title: z.string().max(500).optional(),
        url: z.string().max(2000).optional(),
        location: z.string().max(500).optional(),
        remote_type: z.string().max(50).optional(),
        salary_text: z.string().max(500).optional(),
        salary_min: z.number().int().nullable().optional(),
        salary_max: z.number().int().nullable().optional(),
        posting_text: z.string().optional(),
        notes: z.string().optional().describe("Replaces the notes entirely."),
        append_note: z.string().optional().describe("Appended to the existing notes with today's date."),
        applied_at: z.string().optional().describe("YYYY-MM-DD"),
      },
    },
    safe(async ({ job_id, starred, append_note, ...fields }) => {
      const job = await requireJob(job_id);
      const updates: JobUpdate = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) (updates as Record<string, unknown>)[k] = v;
      }
      if (starred !== undefined) updates.is_starred = starred ? 1 : 0;
      if (typeof updates.posting_text === "string") updates.posting_text = normalizePostingText(updates.posting_text);
      if (append_note) {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
        const base = (updates.notes ?? job.notes).trimEnd();
        updates.notes = `${base}${base ? "\n\n" : ""}[${today}] ${append_note.trim()}`;
      }
      if (fields.status) {
        Object.assign(updates, statusChangeUpdates(fields.status, job.status, { appliedAtGiven: !!fields.applied_at }));
      }
      if (Object.keys(updates).length === 0) return fail("Nothing to update.");
      const updated = await updateJob(job.id, updates);
      return json({ job: jobSummary(updated!) });
    }),
  );

  server.registerTool(
    "update_job_summary",
    {
      title: "Update job activity summary",
      description:
        "Write the activity banner shown at the top of the job in the app: a one-line headline, upcoming scheduled events, the latest interaction, and next steps. Base it on the job's notes (get_job) — log new facts with update_job append_note first, then call this. The stage shown is always the job's status, so keep status current with update_job. A later notes or status change marks the summary stale until it is rewritten.",
      inputSchema: { job_id: z.number().int(), ...JobActivitySchema.shape },
    },
    safe(async ({ job_id, ...activity }) => {
      const job = await requireJob(job_id);
      const updated = await updateJob(job.id, { activity_summary: serializeActivity(activity, job, "mcp") });
      return json({ job: jobSummary(updated!), activity_summary: resolveJobActivity(updated!, []) });
    }),
  );

  server.registerTool(
    "delete_job",
    {
      title: "Delete job",
      description: "Permanently delete a job and its saved submissions. Prefer update_job with a closing status (withdrawn, abandoned, closed) unless the job was added by mistake.",
      inputSchema: { job_id: z.number().int() },
      annotations: { destructiveHint: true },
    },
    safe(async ({ job_id }) => {
      const job = await requireJob(job_id);
      await deleteJob(job.id);
      return json({ deleted: jobSummary(job) });
    }),
  );

  server.registerTool(
    "check_job_status",
    {
      title: "Check if a posting is still open",
      description: "Fetch the job's URL and check whether the posting has been taken down. An active job whose posting is gone is moved to 'closed' (restorable).",
      inputSchema: { job_id: z.number().int() },
      annotations: { openWorldHint: true },
    },
    safe(async ({ job_id }) => {
      const job = await requireJob(job_id);
      if (!job.url) return fail("This job has no URL to check.");
      const result = await checkJobStatus(job);
      const closed = result.status === "closed" && ACTIVE_STATUSES.has(job.status);
      if (closed) await updateJob(job.id, { status: "closed", previous_status: job.status });
      return json({ ...result, status_changed: closed ? `${job.status} → closed` : undefined });
    }),
  );

  server.registerTool(
    "save_submission",
    {
      title: "Save submission",
      description: "Attach a text document to a job — a cover letter, tailored resume, application answers — so it shows under the job's submissions in the app.",
      inputSchema: {
        job_id: z.number().int(),
        type: z.string().max(50).describe("e.g. cover_letter, resume, answers, package, other"),
        label: z.string().max(500),
        content: z.string(),
        format: z.enum(["md", "txt"]).optional().describe("Defaults to md."),
      },
    },
    safe(async ({ job_id, type, label, content, format }) => {
      const job = await requireJob(job_id);
      const sub = await createSubmission({ job_id: job.id, type, label, format: format ?? "md", content });
      return json({ id: sub.id, job_id: job.id, type: sub.type, label: sub.label, created_at: sub.created_at });
    }),
  );

  // ── Resumes & candidate profile ─────────────────────────────────────────

  server.registerTool(
    "list_resumes",
    {
      title: "List resumes",
      description: "Saved resume versions. The first is the default used when no resume_id is given.",
      annotations: { readOnlyHint: true },
    },
    safe(async () => json({ resumes: (await listResumes(userId)).map(resumeSummary) })),
  );

  server.registerTool(
    "get_resume",
    {
      title: "Get resume",
      description: "Full text of a resume. Omit resume_id for the default resume.",
      inputSchema: { resume_id: z.number().int().optional() },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ resume_id }) => {
      const r = await pickResume(resume_id);
      return json({ ...resumeSummary(r), content: r.content });
    }),
  );

  server.registerTool(
    "create_resume",
    {
      title: "Create resume version",
      description: "Save a new resume version (e.g. one tailored to a specific job). Existing resumes are never modified.",
      inputSchema: {
        name: z.string().max(200),
        content: z.string().describe("Plain-text or markdown resume."),
        tags: z.array(z.string()).optional(),
        make_default: z.boolean().optional(),
      },
    },
    safe(async ({ name, content, tags, make_default }) => {
      const r = await createResume(userId, { name, content, tags, is_default: make_default });
      return json(resumeSummary(r));
    }),
  );

  server.registerTool(
    "get_candidate_profile",
    {
      title: "Get candidate profile",
      description:
        "The candidate's grounding documents: the positive profile (what can be claimed) and the negative profile / gaps (what cannot, plus standing reframes), along with contact/profile fields. Read this before writing anything on the candidate's behalf.",
      annotations: { readOnlyHint: true },
    },
    safe(async () => {
      const docs = await getCandidateProfiles(userId);
      const profileData = userId != null ? await getProfileData(userId) : null;
      return json({ positive_profile: docs.profile, negative_profile_gaps: docs.gaps, profile_fields: profileData });
    }),
  );

  server.registerTool(
    "update_candidate_doc",
    {
      title: "Update candidate document",
      description: "Replace the positive profile or the gaps document. This overwrites the whole document — read it first and send the full revised text.",
      inputSchema: {
        kind: z.enum(["profile", "gaps"]),
        content: z.string().max(100_000),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    safe(async ({ kind, content }) => {
      const doc = await upsertCandidateDoc(userId, kind, content);
      return json({ kind: doc.kind, chars: doc.content.length, updated_at: doc.updated_at });
    }),
  );

  // ── Analysis ────────────────────────────────────────────────────────────

  server.registerTool(
    "run_ats_match",
    {
      title: "Run ATS match",
      description:
        "Score a resume against a job's posting with the app's deterministic ATS engine (0-100), save the score on the job, and return the missing skills and failing checks to fix.",
      inputSchema: {
        job_id: z.number().int(),
        resume_id: z.number().int().optional().describe("Defaults to the default resume."),
        save: z.boolean().optional().describe("Store the score on the job. Defaults to true."),
      },
    },
    safe(async ({ job_id, resume_id, save }) => {
      const job = await requireJob(job_id);
      if (!job.posting_text.trim()) return fail("This job has no posting text. Add it with update_job first.");
      const resume = await pickResume(resume_id);
      const report = analyze({
        resumeText: resume.content,
        jobText: job.posting_text,
        company: job.company,
        jobTitle: job.title,
        jobUrl: job.url,
        fileName: "",
      });
      if (save !== false) {
        await saveMatchRun(job, report, { name: resume.name, text: resume.content });
        if (job.company) await addResumeTag(resume.id, job.company);
      }
      return json({ job: `${job.company} — ${job.title}`, resume: resume.name, saved: save !== false, ...matchDigest(report) });
    }),
  );

  server.registerTool(
    "run_fitness_check",
    {
      title: "Run fitness check (rule-based)",
      description:
        "Fast, rule-based 1-10 pursuit score for a job against the candidate profile and gaps. Saves the report on the job. For the full reasoned check, use get_fitness_brief + save_fitness_report instead.",
      inputSchema: { job_id: z.number().int() },
    },
    safe(async ({ job_id }) => {
      const job = await requireJob(job_id);
      const posting = job.posting_text.trim();
      if (!posting) return fail("This job has no posting text. Add it with update_job first.");
      const { profile, gaps } = await getCandidateProfiles(userId);
      const resume = (await listResumes(userId))[0];
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
      await saveFitnessRun(job, result, "deterministic:rule-based");
      return { content: [{ type: "text" as const, text: renderFitnessText(result) }] };
    }),
  );

  async function fitnessBrief(jobId: number) {
    const job = await requireJob(jobId);
    const posting = job.posting_text.trim();
    if (!posting) throw new Error("This job has no posting text. Add it with update_job first.");
    const { profile, gaps } = await getCandidateProfiles(userId);
    const missing = [!profile && "positive profile", !gaps && "negative profile (gaps)"].filter(Boolean);
    if (missing.length) {
      throw new Error(
        `The fitness check needs the candidate's ${missing.join(" and ")}. Add with update_candidate_doc, or use run_fitness_check for rule-based scoring.`,
      );
    }
    return { job, user_message: buildFitnessUserMessage({ profile, gaps, posting }) };
  }

  server.registerTool(
    "get_fitness_brief",
    {
      title: "Get fitness check brief",
      description:
        "Everything needed to run the app's full fitness check yourself: the scoring instructions, the candidate's profile and gaps, and the posting. Follow the instructions, produce a report matching output_schema, then call save_fitness_report.",
      inputSchema: { job_id: z.number().int() },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ job_id }) => {
      const { job, user_message } = await fitnessBrief(job_id);
      return json({
        job_id: job.id,
        instructions: FITNESS_SYSTEM_PROMPT,
        input: user_message,
        output_schema: z.toJSONSchema(FitnessResultSchema, { io: "input" }),
        next_step: `Call save_fitness_report with job_id ${job.id} and the report object.`,
      });
    }),
  );

  server.registerTool(
    "save_fitness_report",
    {
      title: "Save fitness report",
      description: "Validate and store a fitness report produced from get_fitness_brief. Returns the rendered report.",
      inputSchema: {
        job_id: z.number().int(),
        report: z.record(z.string(), z.unknown()).describe("Object matching output_schema from get_fitness_brief."),
        model: z.string().optional().describe("Which model produced the report, for the record."),
      },
    },
    safe(async ({ job_id, report, model }) => {
      const job = await requireJob(job_id);
      const parsed = FitnessResultSchema.safeParse(report);
      if (!parsed.success) return fail(`Report doesn't match the schema: ${z.prettifyError(parsed.error)}`);
      const result: FitnessResult = {
        ...parsed.data,
        company: parsed.data.company || job.company,
        title: parsed.data.title || job.title,
      };
      await saveFitnessRun(job, result, `mcp:${model || "unknown"}`);
      return { content: [{ type: "text" as const, text: renderFitnessText(result) }] };
    }),
  );

  server.registerPrompt(
    "fitness_check",
    {
      title: "Fitness check",
      description: "Run the full fitness check on a job and save the report.",
      argsSchema: { job_id: z.string().describe("Job id (see list_jobs).") },
    },
    async ({ job_id }) => {
      const { job, user_message } = await fitnessBrief(Number(job_id));
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                FITNESS_SYSTEM_PROMPT,
                "",
                user_message,
                "",
                `When done, call the save_fitness_report tool with job_id ${job.id} and the report, then show me the rendered result.`,
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  return server;
}

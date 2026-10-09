import { getDb } from "./index";
import type { Row } from "@libsql/client";
import { updateJob, type JobRow } from "./jobs";
import type { FitnessResult } from "../fitness/schema";
import type { MatchReport } from "../analysis/types";

/**
 * Every profile fitness check and resume ATS match a user runs, kept as
 * history. The job row still carries the current run (score, report) for the
 * jobs table and filters; a run here can be restored to become current again.
 */

export type AnalysisKind = "fitness" | "match";

export interface AnalysisRunRow {
  id: number;
  job_id: number;
  kind: AnalysisKind;
  score: number | null;
  report: string;
  /** "deterministic", "<provider>:<model>", "mcp:<model>", or "ats". Empty for runs from before history. */
  method: string;
  resume_name: string | null;
  /** The resume text a match run scored, so an old report can be reopened against the right document. */
  resume_text: string | null;
  created_at: string;
}

export type AnalysisRunMeta = Omit<AnalysisRunRow, "report" | "resume_text">;

function rowToRun(row: Row): AnalysisRunRow {
  return { ...row } as unknown as AnalysisRunRow;
}

const META_COLS = "id, job_id, kind, score, method, resume_name, created_at";

/** Most recent first. */
export async function listAnalysisRuns(jobId: number, kind?: AnalysisKind): Promise<AnalysisRunMeta[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT ${META_COLS} FROM analysis_runs WHERE job_id = ?${kind ? " AND kind = ?" : ""} ORDER BY id DESC`,
    args: kind ? [jobId, kind] : [jobId],
  });
  return result.rows.map(rowToRun);
}

export async function getAnalysisRun(jobId: number, runId: number): Promise<AnalysisRunRow | undefined> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM analysis_runs WHERE id = ? AND job_id = ?",
    args: [runId, jobId],
  });
  return result.rows[0] ? rowToRun(result.rows[0]) : undefined;
}

async function insertRun(run: Omit<AnalysisRunRow, "id" | "created_at">, createdAt: string): Promise<AnalysisRunRow> {
  const db = await getDb();
  const result = await db.execute({
    sql: `INSERT INTO analysis_runs (job_id, kind, score, report, method, resume_name, resume_text, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [run.job_id, run.kind, run.score, run.report, run.method, run.resume_name, run.resume_text, createdAt],
  });
  return rowToRun(result.rows[0]);
}

/** Record a fitness run and make it the job's current fitness report. */
export async function saveFitnessRun(
  job: Pick<JobRow, "id">,
  result: FitnessResult,
  method: string,
): Promise<{ run: AnalysisRunRow; job: JobRow | undefined }> {
  const runAt = new Date().toISOString();
  const score = Math.round(result.score);
  const report = JSON.stringify(result);
  const run = await insertRun(
    { job_id: job.id, kind: "fitness", score, report, method, resume_name: null, resume_text: null },
    runAt,
  );
  const updated = await updateJob(job.id, { fitness_score: score, fitness_report: report, fitness_run_at: runAt, fitness_run_id: run.id });
  return { run, job: updated };
}

/** Record an ATS match run and make it the job's current match score. */
export async function saveMatchRun(
  job: Pick<JobRow, "id">,
  report: MatchReport,
  resume: { name: string | null; text: string },
): Promise<{ run: AnalysisRunRow; job: JobRow | undefined }> {
  const json = JSON.stringify(report);
  const run = await insertRun(
    { job_id: job.id, kind: "match", score: report.score, report: json, method: "ats", resume_name: resume.name, resume_text: resume.text },
    new Date().toISOString(),
  );
  const updated = await updateJob(job.id, { match_score: report.score, match_report: json, match_resume_name: resume.name, match_run_id: run.id });
  return { run, job: updated };
}

/** Make an earlier run the job's current one again, without adding a new run. */
export async function restoreAnalysisRun(run: AnalysisRunRow): Promise<JobRow | undefined> {
  if (run.kind === "fitness") {
    return updateJob(run.job_id, { fitness_score: run.score, fitness_report: run.report, fitness_run_at: run.created_at, fitness_run_id: run.id });
  }
  return updateJob(run.job_id, { match_score: run.score, match_report: run.report, match_resume_name: run.resume_name, match_run_id: run.id });
}

import { getDb } from "./index";
import type { Row } from "@libsql/client";

/**
 * The two grounding documents the fitness check runs against.
 *
 * - `profile` — the positive record: verified figures, ownership scope, named
 *   technologies held. What can be claimed directly.
 * - `gaps` — the negative record: what the candidate does not have, split into
 *   hard gaps and reframable gaps with their standing reframes.
 *
 * The negative profile is the asset. No commercial match tool has one, which
 * is why none of them can produce a MISS — they score similarity, and
 * similarity peaks exactly when a posting uses your own vocabulary.
 */
export type CandidateDocKind = "profile" | "gaps";

export const CANDIDATE_DOC_KINDS: CandidateDocKind[] = ["profile", "gaps"];

export interface CandidateDocRow {
  id: number;
  user_id: number | null;
  kind: CandidateDocKind;
  content: string;
  created_at: string;
  updated_at: string;
}

// See rowToJob in jobs.ts for why the spread is needed — libsql's Row isn't
// actually a plain object (it carries hidden array-index own properties).
function rowToDoc(row: Row): CandidateDocRow {
  return { ...row } as unknown as CandidateDocRow;
}

export async function getCandidateDoc(
  userId: number | null,
  kind: CandidateDocKind,
): Promise<CandidateDocRow | undefined> {
  const db = await getDb();
  const clause = userId != null ? "user_id = ?" : "user_id IS NULL";
  const args = userId != null ? [userId, kind] : [kind];
  const result = await db.execute({
    sql: `SELECT * FROM candidate_docs WHERE ${clause} AND kind = ? LIMIT 1`,
    args,
  });
  return result.rows[0] ? rowToDoc(result.rows[0]) : undefined;
}

export async function listCandidateDocs(userId: number | null): Promise<CandidateDocRow[]> {
  const db = await getDb();
  const clause = userId != null ? "user_id = ?" : "user_id IS NULL";
  const args = userId != null ? [userId] : [];
  const result = await db.execute({
    sql: `SELECT * FROM candidate_docs WHERE ${clause} ORDER BY kind`,
    args,
  });
  return result.rows.map(rowToDoc);
}

/** Create or replace one document. The unique index on (user_id, kind) is the guard. */
export async function upsertCandidateDoc(
  userId: number | null,
  kind: CandidateDocKind,
  content: string,
): Promise<CandidateDocRow> {
  const db = await getDb();
  const existing = await getCandidateDoc(userId, kind);
  if (existing) {
    const result = await db.execute({
      sql: "UPDATE candidate_docs SET content = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
      args: [content, existing.id],
    });
    return rowToDoc(result.rows[0]);
  }
  const result = await db.execute({
    sql: "INSERT INTO candidate_docs (user_id, kind, content) VALUES (?, ?, ?) RETURNING *",
    args: [userId, kind, content],
  });
  return rowToDoc(result.rows[0]);
}

/**
 * Both documents, for the fitness check's prompt. Missing or blank comes back
 * as an empty string so the caller can refuse the run explicitly rather than
 * silently scoring against half a profile.
 */
export async function getCandidateProfiles(
  userId: number | null,
): Promise<{ profile: string; gaps: string }> {
  const docs = await listCandidateDocs(userId);
  const find = (kind: CandidateDocKind) =>
    docs.find((d) => d.kind === kind)?.content?.trim() ?? "";
  return { profile: find("profile"), gaps: find("gaps") };
}

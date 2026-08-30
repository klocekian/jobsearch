import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/api-auth";
import {
  getCandidateProfiles,
  listCandidateDocs,
  upsertCandidateDoc,
} from "@/lib/db/candidate-docs";
import { getDefaultResume } from "@/lib/db/resumes";

export const runtime = "nodejs";

// Generous: gaps.md and profile.md are long-form documents, and truncating
// either one silently would weaken the check without any visible symptom.
const MAX_DOC_CHARS = 100_000;

const UpdateSchema = z.object({
  profile: z.string().max(MAX_DOC_CHARS).optional(),
  gaps: z.string().max(MAX_DOC_CHARS).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  const [docs, profiles, defaultResume] = await Promise.all([
    listCandidateDocs(userId),
    getCandidateProfiles(userId),
    getDefaultResume(),
  ]);

  const updatedAt = (kind: string) => docs.find((d) => d.kind === kind)?.updated_at ?? null;

  return NextResponse.json({
    profile: profiles.profile,
    gaps: profiles.gaps,
    profile_updated_at: updatedAt("profile"),
    gaps_updated_at: updatedAt("gaps"),
    // Surfaced so the editor can show a staleness line: if the master resume
    // moved after the fact canon was last reviewed, the two may disagree.
    // Visibility only — no assertion that drift actually happened.
    default_resume: defaultResume
      ? { name: defaultResume.name, updated_at: defaultResume.updated_at }
      : null,
  });
}

export async function PUT(request: Request) {
  const userId = await getCurrentUserId();
  try {
    const body: unknown = await request.json();
    const data = UpdateSchema.parse(body);
    if (data.profile === undefined && data.gaps === undefined) {
      return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    }
    if (data.profile !== undefined) await upsertCandidateDoc(userId, "profile", data.profile);
    if (data.gaps !== undefined) await upsertCandidateDoc(userId, "gaps", data.gaps);

    const profiles = await getCandidateProfiles(userId);
    const docs = await listCandidateDocs(userId);
    return NextResponse.json({
      profile: profiles.profile,
      gaps: profiles.gaps,
      profile_updated_at: docs.find((d) => d.kind === "profile")?.updated_at ?? null,
      gaps_updated_at: docs.find((d) => d.kind === "gaps")?.updated_at ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

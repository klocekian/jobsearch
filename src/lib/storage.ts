// Client-side persistence for the tailored resume and the generated cover
// letter. Centralized so the submission snapshot (and each view) share one
// source of truth for storage keys and shapes.

import type { ResumeData } from "./resume/types";
import type { Contact } from "./contact";
import type { ContextMaterial } from "./context";
import type { AiDetection } from "./analysis/types";

// v3: one draft per job (the key is suffixed with the job id).
const COVER_LETTER_STORAGE_KEY = "jobsearch.coverletter.v3";
// Candidate-level supplementary materials, shared by the cover letter + suggestions.
export const CONTEXT_MATERIALS_STORAGE_KEY = "jobsearch.context.v1";
// v2: one tailored resume rewrite per job (the key is suffixed with the job id).
const REWRITE_STORAGE_KEY = "jobsearch.rewrite.v2";

export function isResumeData(value: unknown): value is ResumeData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    Array.isArray(v.experience) &&
    Array.isArray(v.education) &&
    typeof v.skills === "string"
  );
}

/** The full, editable cover-letter draft, persisted so it survives navigation. */
export interface SavedCoverLetter {
  letter: string;
  interests: string;
  contact: Contact;
  date: string;
}

export function loadCoverLetter(jobId: number): SavedCoverLetter | null {
  if (typeof window === "undefined") return null;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(`${COVER_LETTER_STORAGE_KEY}.${jobId}`) ?? "null");
    if (v && typeof v === "object" && typeof (v as SavedCoverLetter).letter === "string") {
      return v as SavedCoverLetter;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCoverLetter(jobId: number, state: SavedCoverLetter): void {
  try {
    localStorage.setItem(`${COVER_LETTER_STORAGE_KEY}.${jobId}`, JSON.stringify(state));
  } catch {
    // ignore unavailable storage
  }
}

/** Just the letter body — what gets saved as the job's submitted cover letter. */
export function coverLetterText(jobId: number): string {
  return loadCoverLetter(jobId)?.letter ?? "";
}

// --- Context materials (candidate-level; persist across jobs) ---

function isContextMaterial(value: unknown): value is ContextMaterial {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.text === "string";
}

export function loadContextMaterials(): ContextMaterial[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CONTEXT_MATERIALS_STORAGE_KEY) ?? "null");
    return Array.isArray(parsed) ? parsed.filter(isContextMaterial) : [];
  } catch {
    return [];
  }
}

export function saveContextMaterials(materials: ContextMaterial[]): void {
  try {
    localStorage.setItem(CONTEXT_MATERIALS_STORAGE_KEY, JSON.stringify(materials));
  } catch {
    // ignore unavailable storage
  }
}

// --- Tailored resume rewrite (one per job) ---

/** The AI suggestion, the working result the user is building, and dismissed changes. */
export interface RewriteState {
  /** The resume the working result started from; a draft built on another resume is ignored. */
  base: string;
  /** Full AI rewrite (the suggestion source). */
  rewrite: string;
  /** The working document the user is assembling (accepted changes + manual edits). */
  result: string;
  /** Keys of suggestions the user dismissed (kept hidden). */
  dismissed: string[];
}

export function loadRewriteState(jobId: number): RewriteState | null {
  if (typeof window === "undefined") return null;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(`${REWRITE_STORAGE_KEY}.${jobId}`) ?? "null");
    if (
      v &&
      typeof v === "object" &&
      typeof (v as RewriteState).base === "string" &&
      typeof (v as RewriteState).rewrite === "string" &&
      typeof (v as RewriteState).result === "string"
    ) {
      const s = v as RewriteState;
      return { base: s.base, rewrite: s.rewrite, result: s.result, dismissed: Array.isArray(s.dismissed) ? s.dismissed : [] };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveRewriteState(jobId: number, state: RewriteState): void {
  try {
    localStorage.setItem(`${REWRITE_STORAGE_KEY}.${jobId}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** The resume tailored for this job, or "" when the working result hasn't moved off its starting resume. */
export function tailoredResumeText(jobId: number): string {
  const s = loadRewriteState(jobId);
  return s && s.result.trim() && s.result !== s.base ? s.result : "";
}

// --- AI-detection result cache (keyed by resume text, so the LLM call is made
// once per distinct resume rather than on every tab switch / refresh) ---

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function loadAiDetection(resumeText: string): AiDetection | null {
  if (typeof window === "undefined") return null;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(`jobsearch.aidetect.${hashText(resumeText)}`) ?? "null");
    if (v && typeof v === "object" && typeof (v as AiDetection).confidence === "number" && Array.isArray((v as AiDetection).patterns)) {
      return v as AiDetection;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiDetection(resumeText: string, detection: AiDetection): void {
  try {
    localStorage.setItem(`jobsearch.aidetect.${hashText(resumeText)}`, JSON.stringify(detection));
  } catch {
    // ignore
  }
}

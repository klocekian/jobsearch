// Client-side persistence for the editable resume and the generated cover
// letter. Centralized so the export packager (and each view) share one source
// of truth for storage keys and shapes.

import type { ResumeData } from "./resume/types";
import type { Contact } from "./contact";
import type { ContextMaterial } from "./context";
import type { AiDetection } from "./analysis/types";

// v3: bust older caches (broken heuristic parse / pre-LinkedIn-field shape).
export const RESUME_STORAGE_KEY = "jobsearch.resume.v3";
// v2: now stores the full draft (letter + interests + header + date), not just text.
export const COVER_LETTER_STORAGE_KEY = "jobsearch.coverletter.v2";
// Candidate-level supplementary materials, shared by the cover letter + suggestions.
export const CONTEXT_MATERIALS_STORAGE_KEY = "jobsearch.context.v1";
// Job-specific tailored resume rewrite (with the user's manual edits).
export const REWRITE_STORAGE_KEY = "jobsearch.rewrite.v1";

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

export function loadSavedResume(): ResumeData | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) ?? "null");
    return isResumeData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveResume(data: ResumeData): void {
  writeKey("local", RESUME_STORAGE_KEY, JSON.stringify(data));
}

/** The full, editable cover-letter draft, persisted so it survives navigation. */
export interface SavedCoverLetter {
  letter: string;
  interests: string;
  contact: Contact;
  date: string;
}

export function loadCoverLetter(): SavedCoverLetter | null {
  if (typeof window === "undefined") return null;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(COVER_LETTER_STORAGE_KEY) ?? "null");
    if (v && typeof v === "object" && typeof (v as SavedCoverLetter).letter === "string") {
      return v as SavedCoverLetter;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCoverLetter(state: SavedCoverLetter): void {
  try {
    localStorage.setItem(COVER_LETTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore unavailable storage
  }
}

/** Just the letter body — used by the export packager. */
export function coverLetterText(): string {
  return loadCoverLetter()?.letter ?? "";
}

export function clearCoverLetter(): void {
  try {
    localStorage.removeItem(COVER_LETTER_STORAGE_KEY);
  } catch {
    // ignore
  }
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

// --- Tailored resume rewrite (job-specific; cleared when the job changes) ---

/** The AI suggestion, the working result the user is building, and dismissed changes. */
export interface RewriteState {
  /** Full AI rewrite (the suggestion source). */
  rewrite: string;
  /** The working document the user is assembling (accepted changes + manual edits). */
  result: string;
  /** Keys of suggestions the user dismissed (kept hidden). */
  dismissed: string[];
}

export function loadRewriteState(): RewriteState | null {
  if (typeof window === "undefined") return null;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(REWRITE_STORAGE_KEY) ?? "null");
    if (
      v &&
      typeof v === "object" &&
      typeof (v as RewriteState).rewrite === "string" &&
      typeof (v as RewriteState).result === "string"
    ) {
      const s = v as RewriteState;
      return { rewrite: s.rewrite, result: s.result, dismissed: Array.isArray(s.dismissed) ? s.dismissed : [] };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveRewriteState(state: RewriteState): void {
  try {
    localStorage.setItem(REWRITE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearRewrite(): void {
  try {
    localStorage.removeItem(REWRITE_STORAGE_KEY);
  } catch {
    // ignore
  }
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

// ── Preferences and list state ───────────────────────────────────────────
// Every key lives here, so components that share one (the jobs list and the
// nav's prev/next both read the list's sort) can't drift on spelling or format.

type Store = "local" | "session";

function readKey(store: Store, key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

/** null removes the key. Unavailable storage (private mode, quota) is ignored. */
function writeKey(store: Store, key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const s = store === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {}
}

export const isOnboardingDone = (): boolean => readKey("local", "has_completed_onboarding_wizard_v1") === "true";
export const markOnboardingDone = (): void => writeKey("local", "has_completed_onboarding_wizard_v1", "true");

/** The job workspace's "with AI" toggle, shared by both Analyze buttons. */
export const loadWithAi = (): boolean => readKey("local", "jobWorkspaceWithAi") === "1";
export const saveWithAi = (on: boolean): void => writeKey("local", "jobWorkspaceWithAi", on ? "1" : "0");

/** null until the user has toggled the activity banner, so the caller's default applies. */
export function loadActivityCollapsed(): boolean | null {
  const v = readKey("local", "jobActivityBannerCollapsed");
  return v === null ? null : v === "1";
}
export const saveActivityCollapsed = (collapsed: boolean): void =>
  writeKey("local", "jobActivityBannerCollapsed", collapsed ? "1" : "0");

export const loadLastSheetUrl = (): string => readKey("local", "jobsLastSheetUrl") ?? "";
export const saveLastSheetUrl = (url: string): void => writeKey("local", "jobsLastSheetUrl", url);

/** Auto-closed jobs whose banner was dismissed; a newly closed job brings it back. */
export function loadDismissedAutoClosed(): number[] {
  try {
    const ids: unknown = JSON.parse(readKey("local", "dismissedAutoClosed") ?? "[]");
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}
export const saveDismissedAutoClosed = (ids: number[]): void => writeKey("local", "dismissedAutoClosed", JSON.stringify(ids));

// The jobs list's sort and filter (per tab), and its ids in that order so a
// job page's prev/next can walk the same list.
export const loadJobListSortKey = (): string => readKey("session", "jobsSortKey") ?? "created_at";
export const saveJobListSortKey = (key: string): void => writeKey("session", "jobsSortKey", key);
export const loadJobListSortOrder = (): "asc" | "desc" => (readKey("session", "jobsSortOrder") === "asc" ? "asc" : "desc");
export const saveJobListSortOrder = (order: "asc" | "desc"): void => writeKey("session", "jobsSortOrder", order);
export const loadJobListStatus = (): string => readKey("session", "jobsStatusFilter") ?? "";
export const saveJobListStatus = (status: string): void => writeKey("session", "jobsStatusFilter", status || null);

export function loadJobListIds(): number[] {
  try {
    const ids: unknown = JSON.parse(readKey("session", "jobListIds") ?? "[]");
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}
export const saveJobListIds = (ids: number[]): void => writeKey("session", "jobListIds", JSON.stringify(ids));

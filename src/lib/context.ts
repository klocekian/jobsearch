// Supplementary "context materials" the candidate provides (brag docs, project
// write-ups, past letters, performance reviews, etc.). These are extra grounding
// for the AI features — the cover letter and the resume suggestions — and they
// describe the *candidate*, not any single job, so they persist across jobs.

export type ContextSource = "pdf" | "docx" | "text" | "paste";

export interface ContextMaterial {
  /** Stable client id for list keys and removal. */
  id: string;
  /** Display name (file name, or a label for pasted snippets). */
  name: string;
  source: ContextSource;
  /** Extracted plain text. */
  text: string;
}

/** Combined-text budget sent to the model, matching the cover-letter input cap. */
export const CONTEXT_CHAR_CAP = 40_000;

/** Flatten the materials into one labelled block for a model prompt. */
export function combinedContextText(materials: ContextMaterial[]): string {
  return materials
    .filter((m) => m.text.trim())
    .map((m) => `--- ${m.name} ---\n${m.text.trim()}`)
    .join("\n\n");
}

/** Total characters across all materials' text (for the size guard). */
export function totalContextChars(materials: ContextMaterial[]): number {
  return materials.reduce((n, m) => n + m.text.length, 0);
}

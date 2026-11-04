import type { AiDetection, CheckItem } from "./types";

interface ReadyScores {
  fitness?: number | null;
  match?: number | null;
  aiBand?: AiDetection["band"] | null;
}

/** Compose existing analysis results with the check of the selected PDF. */
export function readyToApply(items: CheckItem[] | null, scores: ReadyScores = {}) {
  const failures = items?.filter((item) => item.status === "fail").length ?? 0;
  const warnings = items?.filter((item) => item.status === "warning").length ?? 0;
  return {
    parseStatus: items === null ? "unchecked" : failures ? "fail" : warnings ? "warning" : "pass",
    failures,
    warnings,
    needsConfirmation: failures > 0,
    fitness: scores.fitness ?? null,
    match: scores.match ?? null,
    aiBand: scores.aiBand ?? null,
  };
}

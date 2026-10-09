/**
 * Vocabulary that reads as machine-written. One list so the detector flags
 * exactly what the rewrite and the cover letter are told to avoid. (The
 * offline heuristic in lib/analysis/ai-detection.ts keeps its own regex-ready
 * list with inflections.)
 */
export const AI_TELL_WORDS = [
  "delve", "leverage", "seamless", "robust", "holistic", "tapestry", "testament",
  "underscore", "pivotal", "realm", "resonate", "myriad", "elevate", "unlock",
  "cutting-edge", "game-changing", "best-in-class", "synergy",
];

/** Stock openers that mark a passage as generated. */
export const AI_TELL_OPENERS = ["In today's...", "At the intersection of...", "ever-evolving", "fast-paced", "passionate about"];

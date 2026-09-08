import type { FitnessResult } from "./schema";

/**
 * Render a fitness result as plain text, for the note written onto the job.
 *
 * Ported from render() in fitness_check.py so a note saved from the app reads
 * identically to one produced by the CLI — the same report in the same shape,
 * whichever tool ran it.
 *
 * Every requirement prints verbatim next to its verdict. That is deliberate:
 * it makes the whole report auditable in fifteen seconds. A tool you can't
 * check is a tool that drifts.
 */

const EMPLOYER_TYPE_LABELS: Record<string, string> = {
  in_house: "in-house / end-user",
  vendor: "vendor / product company",
  consultancy: "consultancy / SI / staffing",
  unknown: "unknown",
};

const RULE = "=".repeat(78);

function mark(verdict: string): string {
  return verdict.padEnd(8);
}

export function renderFitnessText(r: FitnessResult): string {
  const out: string[] = [];

  out.push("");
  out.push(`${r.company} — ${r.title}`);
  out.push(`${r.location} · ${r.work_arrangement} · travel ${r.travel_percent} · ${r.salary}`);
  out.push(RULE);

  out.push("");
  if (r.hard_stop.triggered) {
    out.push(`HARD STOP: ${r.hard_stop.reason || "(no reason given)"}`);
  } else {
    out.push("HARD STOP CHECK: clear");
  }

  out.push("");
  out.push(`FITNESS: ${r.score}/10  (${r.band})`);
  out.push(`  ${r.one_line}`);

  out.push("");
  out.push(`EMPLOYER TYPE: ${EMPLOYER_TYPE_LABELS[r.employer_type] ?? r.employer_type}`);
  if (r.employer_type_note) out.push(`  ${r.employer_type_note}`);

  out.push("");
  out.push("LOGISTICS (light touch at this stage)");
  out.push(`  ${r.logistics_note}`);

  const objective = r.stated_minimums.filter((m) => m.kind !== "dispositional");
  const dispositional = r.stated_minimums.filter((m) => m.kind === "dispositional");

  out.push("");
  out.push(`STATED MINIMUMS, OBJECTIVE (${objective.length})`);
  if (objective.length === 0) out.push("  Posting states no checkable minimums.");
  for (const m of objective) {
    out.push("");
    out.push(`  [${mark(m.verdict)}] ${m.verbatim}`);
    if (m.note) out.push(`              -> ${m.note}`);
  }

  if (dispositional.length > 0) {
    out.push("");
    out.push(`DISPOSITIONAL (${dispositional.length})  <- interview material, never scored`);
    for (const m of dispositional) {
      out.push("");
      out.push(`  [${mark(m.verdict)}] ${m.verbatim}`);
      if (m.note) out.push(`              -> ${m.note}`);
    }
  }

  if (r.preferred.length > 0) {
    out.push("");
    out.push("PREFERRED (informs score modestly)");
    for (const p of r.preferred) {
      out.push(`  [${mark(p.verdict)}] ${p.verbatim}`);
    }
  }

  if (r.gaps.length > 0) {
    out.push("");
    out.push("GAPS AND FRAMINGS");
    for (const g of r.gaps) {
      out.push("");
      out.push(`  Gap:     ${g.gap}`);
      out.push(`  Framing: ${g.framing}`);
    }
  }

  out.push("");
  out.push("OUTCOME SPECTRUM");
  out.push(`  Best case:  ${r.outcomes.best_case}`);
  out.push(`  Worst case: ${r.outcomes.worst_case}`);
  out.push(`  Probable:   ${r.outcomes.probable}`);

  out.push("");
  out.push("TRADEOFFS OF PURSUING");
  out.push(`  Gained: ${r.tradeoffs.gained}`);
  out.push(`  Lost:   ${r.tradeoffs.lost}`);

  out.push("");
  out.push(RULE);
  out.push(`VERDICT: ${r.verdict}`);
  out.push("");

  return out.join("\n");
}

/** Header line used when the report is prepended into the job's notes. */
export function fitnessNoteHeader(runAt: string, model: string): string {
  return `--- Fitness check · ${runAt} · ${model} ---`;
}

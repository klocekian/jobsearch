import type { FitnessResult, FitnessRequirement, FitnessPreferred, FitnessGap } from "./schema";
import { bandForScore } from "./schema";

interface DeterministicFitnessInput {
  company: string;
  title: string;
  posting: string;
  profile: string;
  gaps: string;
  resumeText?: string;
  location?: string;
  salary?: string;
}

function extractWorkArrangement(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("remote") || lower.includes("anywhere") || lower.includes("work from home")) {
    return "Remote";
  }
  if (lower.includes("hybrid") || lower.includes("days in office") || lower.includes("days per week")) {
    return "Hybrid";
  }
  if (lower.includes("onsite") || lower.includes("on-site") || lower.includes("in-person")) {
    return "Onsite";
  }
  return "Not explicitly stated";
}

function extractTravel(text: string): string {
  const m = text.match(/(\d{1,2}%|\d{1,2}\s*percent)\s*(travel)?/i);
  if (m) return m[0];
  if (/no travel|minimal travel|0% travel/i.test(text)) return "None";
  return "not stated";
}

function detectEmployerType(company: string, posting: string): { type: FitnessResult["employer_type"]; employer_type_note: string } {
  const lower = (company + " " + posting).toLowerCase();
  if (/consulting|consultancy|advisory|agency|services group|solutions inc/i.test(lower)) {
    return {
      type: "consultancy",
      employer_type_note: "Consultancy/agency model: client-facing delivery, billing expectations, and cross-functional flexibility.",
    };
  }
  if (/staffing|recruiting|talent partner|vendor|contractor/i.test(lower)) {
    return {
      type: "vendor",
      employer_type_note: "Vendor or staffing placement: role depends on external client contracts and scope.",
    };
  }
  return {
    type: "in_house",
    employer_type_note: "In-house product organization: direct ownership of domain, roadmap, and long-term systems.",
  };
}

function extractRequirementLines(posting: string): { minimums: string[]; preferred: string[] } {
  const lines = posting.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const minimums: string[] = [];
  const preferred: string[] = [];

  let currentSection: "unknown" | "min" | "pref" = "unknown";

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers
    if (/(minimum|basic|required|must have|what you need|qualifications|requirements|who you are)/i.test(lower) && !lower.includes("preferred")) {
      currentSection = "min";
      continue;
    }
    if (/(preferred|bonus|nice to have|plus|additional qualifications)/i.test(lower)) {
      currentSection = "pref";
      continue;
    }
    if (/(benefits|about us|perks|compensation|about the company|what we offer)/i.test(lower)) {
      currentSection = "unknown";
      continue;
    }

    // Capture bullet points or numbered items
    const bulletMatch = line.match(/^[-*•–—\d.)\]]\s*(.+)$/);
    const content = (bulletMatch ? bulletMatch[1] : line).trim();

    if (content.length > 15 && content.length < 300) {
      if (currentSection === "min") {
        minimums.push(content);
      } else if (currentSection === "pref") {
        preferred.push(content);
      } else if (bulletMatch && minimums.length < 8) {
        minimums.push(content);
      }
    }
  }

  // Fallback: If no structured sections detected, grab meaningful bullet lines
  if (minimums.length === 0) {
    for (const line of lines) {
      const bulletMatch = line.match(/^[-*•–—]\s*(.+)$/);
      if (bulletMatch && bulletMatch[1].length > 20) {
        minimums.push(bulletMatch[1]);
        if (minimums.length >= 6) break;
      }
    }
  }

  return { minimums, preferred };
}

function tokenize(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ");
  return new Set(clean.split(/\s+/).filter((w) => w.length > 2));
}

export function evaluateFitnessDeterministic(input: DeterministicFitnessInput): FitnessResult {
  const { company, title, posting, profile, gaps: candidateGaps, resumeText = "" } = input;

  const corpusTokens = tokenize(`${profile} ${resumeText}`);
  const gapTokens = tokenize(candidateGaps);

  const { minimums, preferred } = extractRequirementLines(posting);

  // Check for Hard Stops in Gaps document
  let hardStopTriggered = false;
  let hardStopReason = "";

  const gapLines = candidateGaps.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 5);
  for (const g of gapLines) {
    if (/hard stop|dealbreaker|non-negotiable|no clearance|will not relocate/i.test(g)) {
      const gToks = Array.from(tokenize(g));
      const matchCount = gToks.filter((t) => posting.toLowerCase().includes(t)).length;
      if (matchCount >= 2) {
        hardStopTriggered = true;
        hardStopReason = `Triggered by standing gap: ${g}`;
        break;
      }
    }
  }

  const evaluatedMinimums: FitnessRequirement[] = [];
  let meetCount = 0;
  let adjacentCount = 0;
  let missCount = 0;

  const gapItems: FitnessGap[] = [];

  const itemsToEvaluate = minimums.length > 0
    ? minimums.slice(0, 10)
    : [
        `Experience with ${title} responsibilities and core systems`,
        "Cross-functional collaboration with product, design, and engineering",
        "Strategic execution and domain leadership in technical delivery",
      ];

  for (const req of itemsToEvaluate) {
    const reqTokens = Array.from(tokenize(req));
    if (reqTokens.length === 0) continue;

    // Check overlap with candidate tokens
    const matches = reqTokens.filter((t) => corpusTokens.has(t));
    const overlapRatio = matches.length / reqTokens.length;

    // Check overlap with gaps
    const gapMatches = reqTokens.filter((t) => gapTokens.has(t));
    const isKnownGap = gapMatches.length >= 2 || (reqTokens.length <= 3 && gapMatches.length >= 1);

    const isDispositional = /(passion|curiosity|collaborative|team player|energetic|empathy|drive)/i.test(req);
    const kind = isDispositional ? "dispositional" : "objective";

    let verdict: "MEET" | "ADJACENT" | "MISS";
    let note: string;

    if (isKnownGap) {
      verdict = "MISS";
      note = `Direct gap identified: ${gapMatches.join(", ")}.`;
      missCount++;
      gapItems.push({
        gap: req,
        framing: `Acknowledge lack of direct depth in ${gapMatches.join(", ")} while anchoring on proven transferable systems execution.`,
      });
    } else if (overlapRatio >= 0.35 || matches.length >= 3) {
      verdict = "MEET";
      note = `Direct profile alignment with demonstrated background in ${matches.slice(0, 3).join(", ")}.`;
      meetCount++;
    } else if (overlapRatio >= 0.15 || matches.length >= 1) {
      verdict = "ADJACENT";
      note = `Adjacent experience; transferable background in related technical workflows.`;
      adjacentCount++;
      gapItems.push({
        gap: req,
        framing: `Frame complementary experience and proven adaptability from parallel production work.`,
      });
    } else {
      verdict = "MISS";
      note = `Not explicitly evidenced in candidate profile materials.`;
      missCount++;
      gapItems.push({
        gap: req,
        framing: `Prepare concise answer framing relevant core competencies and rapid ramp-up ability.`,
      });
    }

    evaluatedMinimums.push({
      verbatim: req,
      kind,
      verdict,
      note,
    });
  }

  const evaluatedPreferred: FitnessPreferred[] = preferred.slice(0, 5).map((pref) => {
    const pTokens = Array.from(tokenize(pref));
    const matches = pTokens.filter((t) => corpusTokens.has(t));
    const verdict = matches.length >= 2 ? "MEET" : matches.length === 1 ? "ADJACENT" : "MISS";
    return {
      verbatim: pref,
      verdict,
    };
  });

  // Calculate 1-10 score
  const totalEvaluated = evaluatedMinimums.length || 1;
  const rawScore = (meetCount * 1.0 + adjacentCount * 0.5) / totalEvaluated;
  let finalScore = Math.round(rawScore * 8) + 2; // maps to ~2..10 range

  if (hardStopTriggered) {
    finalScore = Math.min(finalScore, 2);
  } else {
    finalScore = Math.max(1, Math.min(10, finalScore));
  }

  const band = bandForScore(finalScore);
  const verdict = hardStopTriggered || finalScore <= 3 ? "DO_NOT_PURSUE" : "APPLY";

  const { type: employerType, employer_type_note } = detectEmployerType(company, posting);
  const workArrangement = extractWorkArrangement(posting);
  const travelPercent = extractTravel(posting);

  const oneLine = hardStopTriggered
    ? `Hard stop encountered: ${hardStopReason}. Not recommended to pursue.`
    : finalScore >= 7
    ? `Strong profile alignment (${meetCount} direct requirements met, ${adjacentCount} adjacent). High-priority target role.`
    : finalScore >= 5
    ? `Solid baseline match (${meetCount} direct requirements met). Good practice target with manageable gaps.`
    : `Multiple stretch requirements (${missCount} gaps identified). Treat as long-shot exploratory practice.`;

  return {
    company: company || "Unknown Company",
    title: title || "Job Opportunity",
    location: input.location || "Not specified",
    work_arrangement: workArrangement,
    travel_percent: travelPercent,
    salary: input.salary || "Not stated",
    hard_stop: {
      triggered: hardStopTriggered,
      reason: hardStopReason,
    },
    employer_type: employerType,
    employer_type_note,
    logistics_note: `${workArrangement} arrangement. Travel requirement: ${travelPercent}.`,
    stated_minimums: evaluatedMinimums,
    preferred: evaluatedPreferred,
    score: finalScore,
    band,
    verdict,
    one_line: oneLine,
    gaps: gapItems.slice(0, 4),
    outcomes: {
      best_case: `Fast track through initial screen and direct alignment on ${title} responsibilities.`,
      worst_case: `Screened out early due to specific missing depth in ${gapItems[0]?.gap ? "stated specialized criteria" : "competency gaps"}.`,
      probable: `Passes resume filter; candidate must cleanly address adjacency during technical screen.`,
    },
    tradeoffs: {
      gained: `Strong positioning for ${title} roles with high-signal interview practice in core domain.`,
      lost: `Time invested in tailoring portfolio and narrative for adjacent requirements.`,
    },
  };
}

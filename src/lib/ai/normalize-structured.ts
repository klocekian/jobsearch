
/**
 * Normalizes raw JSON output from any LLM before passing it to Zod validation.
 * Unwraps outer envelope wrappers, maps common field aliases, and repairs minor formatting issues.
 */
export function normalizeStructuredPayload(raw: unknown, schemaName?: string): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  let obj = raw as Record<string, unknown>;

  // 1. Unwrap common outer wrapper keys
  const wrapperKeys = [
    schemaName,
    schemaName ? schemaName.toLowerCase() : null,
    schemaName ? schemaName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() : null, // e.g. FitnessResult -> fitness_result
    "result",
    "data",
    "fitness_result",
    "fitnessResult",
    "response",
    "output",
    "payload",
  ].filter(Boolean) as string[];

  for (const key of wrapperKeys) {
    if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      const inner = obj[key] as Record<string, unknown>;
      // If inner has key candidate indicators, unwrap it
      if (
        "stated_minimums" in inner ||
        "company" in inner ||
        "title" in inner ||
        "score" in inner ||
        "verdict" in inner
      ) {
        obj = inner;
        break;
      }
    }
  }

  // 2. Map common field aliases
  if (!obj.stated_minimums) {
    if (Array.isArray(obj.minimum_qualifications)) obj.stated_minimums = obj.minimum_qualifications;
    else if (Array.isArray(obj.minimums)) obj.stated_minimums = obj.minimums;
    else if (Array.isArray(obj.requirements)) obj.stated_minimums = obj.requirements;
    else if (Array.isArray(obj.required)) obj.stated_minimums = obj.required;
  }

  if (!obj.preferred) {
    if (Array.isArray(obj.preferred_qualifications)) obj.preferred = obj.preferred_qualifications;
    else if (Array.isArray(obj.preferred_items)) obj.preferred = obj.preferred_items;
    else if (Array.isArray(obj.bonus)) obj.preferred = obj.bonus;
    else if (Array.isArray(obj.nice_to_have)) obj.preferred = obj.nice_to_have;
  }

  if (obj.hardStop && !obj.hard_stop) {
    obj.hard_stop = obj.hardStop;
  }

  if (obj.workArrangement && !obj.work_arrangement) {
    obj.work_arrangement = obj.workArrangement;
  }

  if (obj.travelPercent && !obj.travel_percent) {
    obj.travel_percent = obj.travelPercent;
  }

  if (obj.employerType && !obj.employer_type) {
    obj.employer_type = obj.employerType;
  }

  if (obj.employerTypeNote && !obj.employer_type_note) {
    obj.employer_type_note = obj.employerTypeNote;
  }

  if (obj.logisticsNote && !obj.logistics_note) {
    obj.logistics_note = obj.logisticsNote;
  }

  if (obj.oneLine && !obj.one_line) {
    obj.one_line = obj.oneLine;
  }

  return obj;
}

/**
 * Safely parse a JSON string from LLM responses, repairing common issues like markdown fences or trailing commas.
 */
export function safeParseLlmJson(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Attempt basic repair for truncated JSON or unclosed quotes/brackets
    let repaired = cleaned;
    let inQuote = false;
    for (let i = 0; i < repaired.length; i++) {
      if (repaired[i] === '"' && (i === 0 || repaired[i - 1] !== "\\")) {
        inQuote = !inQuote;
      }
    }
    if (inQuote) {
      repaired += '"';
    }

    const stack: string[] = [];
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === c) {
          stack.pop();
        }
      }
    }
    while (stack.length > 0) {
      repaired += stack.pop();
    }

    try {
      return JSON.parse(repaired);
    } catch {
      throw firstErr;
    }
  }
}

/**
 * Repair a fitness report from a model without native structured output:
 * the aliases models reach for (camelCase, "requirements" for stated
 * minimums) mapped onto the schema's own field names.
 */
export function normalizeFitnessPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  const firstArray = (...keys: string[]) => keys.map((k) => obj[k]).find(Array.isArray);
  obj.stated_minimums ??= firstArray("minimum_qualifications", "minimums", "requirements", "required");
  obj.preferred ??= firstArray("preferred_qualifications", "preferred_items", "bonus", "nice_to_have");

  const aliases: Record<string, string> = {
    hardStop: "hard_stop",
    workArrangement: "work_arrangement",
    travelPercent: "travel_percent",
    employerType: "employer_type",
    employerTypeNote: "employer_type_note",
    logisticsNote: "logistics_note",
    oneLine: "one_line",
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (obj[from] && !obj[to]) obj[to] = obj[from];
  }
  return obj;
}

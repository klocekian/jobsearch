/** Short date like "Jun 3" — no year, matches the jobs table's Added/Applied columns. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("T") || iso.includes(" ") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

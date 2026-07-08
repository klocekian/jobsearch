export const STATUS_OPTIONS = [
  { value: "saved", label: "Saved" },
  { value: "applying", label: "Applying" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Recruiter" },
  { value: "interview2", label: "Interview" },
  { value: "onsite", label: "Onsite" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "abandoned", label: "Abandoned" },
  { value: "closed", label: "Closed" },
] as const;

/**
 * Canonical per-status color, shared by the funnel chart's dots/lines and
 * the status pill in the jobs table — the single source of truth so the two
 * views are guaranteed to agree, not just visually similar.
 */
export const STATUS_DOT_COLORS: Record<string, string> = {
  saved: "#94a3b8",
  applying: "#f59e0b",
  applied: "#3b82f6",
  interview: "#10b981",
  interview2: "#06b6d4",
  onsite: "#14b8a6",
  offer: "#8b5cf6",
  accepted: "#22c55e",
  rejected: "#f43f5e",
  declined: "#fda4af",
  withdrawn: "#a8a29e",
  abandoned: "#78716c",
  closed: "#94a3b8",
};

export const STATUS_BADGE_VARIANTS: Record<string, "success" | "error" | "warning" | "blue" | "purple" | "teal" | "neutral"> = {
  saved: "neutral",
  applying: "warning",
  applied: "blue",
  interview: "success",
  interview2: "teal",
  onsite: "teal",
  offer: "purple",
  accepted: "success",
  rejected: "error",
  withdrawn: "neutral",
  closed: "neutral",
  abandoned: "neutral",
};

export const STATUS_COLORS: Record<string, string> = {
  saved: "bg-slate-100 text-slate-600",
  applying: "bg-amber-50 text-amber-700",
  applied: "bg-blue-50 text-blue-700",
  interview: "bg-emerald-50 text-emerald-700",
  interview2: "bg-cyan-50 text-cyan-700",
  onsite: "bg-teal-50 text-teal-700",
  offer: "bg-purple-50 text-purple-700",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-rose-50 text-rose-600",
  declined: "bg-orange-50 text-orange-600",
  withdrawn: "bg-slate-100 text-slate-500",
  abandoned: "bg-stone-100 text-stone-500",
  closed: "bg-slate-100 text-slate-400",
};

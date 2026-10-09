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

/**
 * Text-safe counterpart to STATUS_DOT_COLORS: the same hue per status, darkened
 * for light mode and lightened for dark mode so labels clear WCAG AA (4.5:1).
 * Use this whenever a status color is applied to text rather than a dot or line.
 */
export const STATUS_TEXT_COLORS: Record<string, string> = {
  saved: "light-dark(#475569, #94a3b8)",
  applying: "light-dark(#b45309, #fbbf24)",
  applied: "light-dark(#1d4ed8, #60a5fa)",
  interview: "light-dark(#047857, #34d399)",
  interview2: "light-dark(#0e7490, #22d3ee)",
  onsite: "light-dark(#0f766e, #2dd4bf)",
  offer: "light-dark(#6d28d9, #a78bfa)",
  accepted: "light-dark(#15803d, #4ade80)",
  rejected: "light-dark(#be123c, #fb7185)",
  declined: "light-dark(#9f1239, #fda4af)",
  withdrawn: "light-dark(#57534e, #a8a29e)",
  abandoned: "light-dark(#57534e, #a8a29e)",
  closed: "light-dark(#475569, #94a3b8)",
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
  saved: "bg-muted text-secondary",
  applying: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  applied: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  interview: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  interview2: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  onsite: "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  offer: "bg-purple-500/15 text-purple-800 dark:text-purple-300",
  accepted: "bg-green-500/20 text-green-800 dark:text-green-300",
  rejected: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  declined: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  withdrawn: "bg-muted text-secondary",
  abandoned: "bg-muted text-secondary",
  closed: "bg-muted text-disabled",
};

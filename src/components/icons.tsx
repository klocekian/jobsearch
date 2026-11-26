import { Icon, type IconName } from "./iconstack/Icon";
import type { CheckStatus } from "@/lib/analysis/types";
import { STATUS_DOT_COLORS } from "@/lib/status";

/** Matches the funnel chart's per-status color — same palette, ties the job status Selector to the Funnel view. */
export function JobStatusDot({ status }: { status: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_DOT_COLORS[status] ?? STATUS_DOT_COLORS.saved }}
    />
  );
}

interface StatusIconProps {
  status: CheckStatus;
  className?: string;
}

/** Green check / amber warning / red x, matching the Match Report styling. */
export function StatusIcon({ status, className = "" }: StatusIconProps) {
  const color = status === "pass" ? "text-emerald-600 dark:text-emerald-400" : status === "warning" ? "text-amber-700 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return <Icon
    name={status === "pass" ? "circle-check" : status === "warning" ? "alert-circle" : "circle-x"}
    size={20} className={`h-5 w-5 shrink-0 ${color} ${className}`}
    role="img" aria-hidden={false} aria-label={status}
  />;
}

interface ScoreRingProps {
  score: number;
  size?: number;
}

/** Circular gradient score ring like the Jobscan report header. */
export function ScoreRing({ score, size = 88 }: ScoreRingProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border, #e2e8f0)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-primary">
        {score}
      </span>
    </div>
  );
}

export function ChevronLeftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <Icon name="chevron-left" size={20} className={className} />;
}

export function ChevronRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <Icon name="chevron-right" size={20} className={className} />;
}

export function ChevronUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <Icon name="chevron-up" className={className} />;
}

export function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <Icon name="chevron-down" className={className} />;
}

const tipIcons = {
  calendar: "calendar-check",
  target: "target",
  dumbbell: "barbell",
  filter: "filter",
  clock: "clock",
  link: "link",
  lightbulb: "bulb",
  compass: "compass",
} satisfies Record<string, IconName>;

export type TipIconName = keyof typeof tipIcons;

/** Small line icon for strategy tips and principles, drawn in currentColor. */
export function TipIcon({ name, className = "h-3.5 w-3.5" }: { name: TipIconName; className?: string }) {
  return <Icon name={tipIcons[name]} size={14} className={className} />;
}

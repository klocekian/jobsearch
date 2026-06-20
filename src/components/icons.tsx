import type { CheckStatus } from "@/lib/analysis/types";

interface StatusIconProps {
  status: CheckStatus;
  className?: string;
}

/** Green check / amber warning / red x, matching the Match Report styling. */
export function StatusIcon({ status, className = "" }: StatusIconProps) {
  if (status === "pass") {
    return (
      <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-emerald-500 ${className}`} aria-label="pass">
        <circle cx="10" cy="10" r="9" className="fill-current opacity-15" />
        <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "warning") {
    return (
      <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-amber-500 ${className}`} aria-label="warning">
        <circle cx="10" cy="10" r="9" className="fill-current opacity-15" />
        <path d="M10 5.5v5M10 13.5v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-rose-500 ${className}`} aria-label="fail">
      <circle cx="10" cy="10" r="9" className="fill-current opacity-15" />
      <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
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
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-slate-800">
        {score}
      </span>
    </div>
  );
}

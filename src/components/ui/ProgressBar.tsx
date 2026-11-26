import styles from "./ui.module.css";

export function ProgressBar({ value, max = 100, label, isLabelHidden, className = "" }: { value: number; max?: number; label: string; isLabelHidden?: boolean; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      {!isLabelHidden && <div className="mb-1 text-xs text-secondary">{label}</div>}
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={styles.progress} style={{ height: "inherit", minHeight: 4 }}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

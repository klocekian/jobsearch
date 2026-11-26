"use client";

import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function Switch({ label, value, onChange }: { label: ReactNode; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} className={styles.switch} onClick={() => onChange(!value)}>
      <span className={styles.switchTrack} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { onRovingKeyDown } from "./rovingKeys";
import styles from "./ui.module.css";

const Ctx = createContext<{ value: string; onChange: (v: string) => void } | null>(null);

export function SegmentedControl({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={styles.segmented} onKeyDown={(e) => onRovingKeyDown(e, onChange)}>
      <Ctx.Provider value={{ value, onChange }}>{children}</Ctx.Provider>
    </div>
  );
}

export function SegmentedControlItem({ value, label }: { value: string; label: ReactNode }) {
  const ctx = useContext(Ctx);
  return (
    <button type="button" data-value={value} tabIndex={ctx?.value === value ? 0 : -1} className={styles.segment} aria-pressed={ctx?.value === value} onClick={() => ctx?.onChange(value)}>
      {label}
    </button>
  );
}

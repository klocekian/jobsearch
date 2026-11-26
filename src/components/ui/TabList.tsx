"use client";

import { createContext, useContext, type ReactNode } from "react";
import { onRovingKeyDown } from "./rovingKeys";
import styles from "./ui.module.css";

const Ctx = createContext<{ value: string; onChange: (v: string) => void } | null>(null);

/** View switcher tabs: buttons, the selected one marked aria-current. */
export function TabList({ value, onChange, label, className = "", children }: { value: string; onChange: (value: string) => void; label?: string; className?: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className={`${styles.tabs} ${className}`} onKeyDown={(e) => onRovingKeyDown(e, onChange)}>
      <Ctx.Provider value={{ value, onChange }}>{children}</Ctx.Provider>
    </nav>
  );
}

export function Tab({ value, label }: { value: string; label: ReactNode }) {
  const ctx = useContext(Ctx);
  return (
    <button type="button" data-value={value} tabIndex={ctx?.value === value ? 0 : -1} className={styles.tab} aria-current={ctx?.value === value ? "page" : undefined} onClick={() => ctx?.onChange(value)}>
      {label}
    </button>
  );
}

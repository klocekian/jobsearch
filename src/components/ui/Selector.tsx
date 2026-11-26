"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/iconstack/Icon";
import styles from "./ui.module.css";

export interface SelectorOption {
  value: string;
  label: string;
  /** Not drawn inside the native list; the selected one shows as `startIcon` if given. */
  icon?: ReactNode;
}

interface SelectorProps {
  label: string;
  isLabelHidden?: boolean;
  options: SelectorOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  startIcon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** A native select, styled to match the text inputs. */
export function Selector({ label, isLabelHidden, options, value, onChange, placeholder, startIcon, size = "md", className = "" }: SelectorProps) {
  const id = useId();
  const hasPlaceholderOption = placeholder !== undefined && !options.some((o) => o.value === "");
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={isLabelHidden ? styles.srOnly : styles.fieldLabel}>{label}</label>
      <div className={`${styles.selectWrap} ${startIcon ? styles.hasStart : ""}`}>
        {startIcon && <span className={styles.selectStart}>{startIcon}</span>}
        <select id={id} className={`${styles.control} ${size === "sm" ? styles.controlSm : ""}`} value={value} onChange={(e) => onChange(e.target.value)}>
          {hasPlaceholderOption && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className={styles.selectChevron}><Icon name="chevron-down" size={14} /></span>
      </div>
    </div>
  );
}

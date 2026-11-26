"use client";

import { useId } from "react";
import styles from "./ui.module.css";

interface TextAreaProps {
  label: string;
  isLabelHidden?: boolean;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export function TextArea({ label, isLabelHidden, value, onChange, rows = 4, placeholder, className = "" }: TextAreaProps) {
  const id = useId();
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={isLabelHidden ? styles.srOnly : styles.fieldLabel}>{label}</label>
      <textarea id={id} className={styles.control} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

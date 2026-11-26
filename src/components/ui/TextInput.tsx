"use client";

import { useId } from "react";
import styles from "./ui.module.css";

interface TextInputProps {
  label: string;
  isLabelHidden?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter. */
  onEnter?: () => void;
  placeholder?: string;
  type?: "text" | "password" | "email" | "url";
  size?: "sm" | "md";
  className?: string;
}

export function TextInput({ label, isLabelHidden, value, onChange, onEnter, placeholder, type = "text", size = "md", className = "" }: TextInputProps) {
  const id = useId();
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={isLabelHidden ? styles.srOnly : styles.fieldLabel}>{label}</label>
      <input
        id={id}
        type={type}
        className={`${styles.control} ${size === "sm" ? styles.controlSm : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onEnter && ((e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); onEnter(); } })}
      />
    </div>
  );
}

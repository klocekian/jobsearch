import type { ReactNode } from "react";
import styles from "./ui.module.css";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error" | "blue" | "cyan" | "teal" | "green" | "orange" | "pink" | "purple";

export function Badge({ label, variant = "neutral", className = "" }: { label: ReactNode; variant?: BadgeVariant; className?: string }) {
  return <span className={`${styles.badge} ${variant !== "neutral" ? styles[`badge-${variant}`] : ""} ${className}`}>{label}</span>;
}

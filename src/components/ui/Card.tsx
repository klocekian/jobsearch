import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function Card({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

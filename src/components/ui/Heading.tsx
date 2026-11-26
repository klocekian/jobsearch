import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function Heading({ level = 2, className = "", children }: { level?: 1 | 2 | 3 | 4 | 5 | 6; className?: string; children?: ReactNode }) {
  const Tag = `h${level}` as const;
  return <Tag className={`${styles.heading} ${styles[`h${level}`]} ${className}`}>{children}</Tag>;
}

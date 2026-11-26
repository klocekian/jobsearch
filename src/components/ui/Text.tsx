import type { CSSProperties, ElementType, ReactNode } from "react";
import styles from "./ui.module.css";

interface TextProps {
  type?: "display-3" | "body" | "supporting" | "label";
  as?: ElementType;
  display?: "block" | "inline";
  weight?: "normal" | "medium" | "semibold" | "bold";
  color?: "primary" | "secondary";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const WEIGHTS = { normal: 400, medium: 500, semibold: 600, bold: 700 };

export function Text({ type = "body", as: Tag = "span", display, weight, color, className = "", style, children }: TextProps) {
  return (
    <Tag
      className={`${styles[type]} ${className}`}
      style={{
        ...(display && { display }),
        ...(weight && { fontWeight: WEIGHTS[weight] }),
        ...(color && { color: `var(--color-text-${color})` }),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

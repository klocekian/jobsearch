import type { ReactNode } from "react";

interface HStackProps {
  /** In 4px steps. */
  gap?: number;
  className?: string;
  children?: ReactNode;
}

export function HStack({ gap = 0, className = "", children }: HStackProps) {
  return <div className={`flex flex-row ${className}`} style={{ gap: gap * 4 }}>{children}</div>;
}

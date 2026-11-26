import type { ReactNode } from "react";

interface StackProps {
  /** In 4px steps. */
  gap?: number;
  className?: string;
  children?: ReactNode;
}

export function Stack({ gap = 0, className = "", children }: StackProps) {
  return <div className={`flex flex-col ${className}`} style={{ gap: gap * 4 }}>{children}</div>;
}
export { HStack } from "./HStack";

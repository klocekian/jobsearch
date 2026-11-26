import NextLink from "next/link";
import type { MouseEvent, ReactNode } from "react";
import styles from "./ui.module.css";

interface LinkProps {
  /** Without one, it is a button that looks like a link. */
  href?: string;
  isExternalLink?: boolean;
  hasUnderline?: boolean;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  className?: string;
  children?: ReactNode;
}

export function Link({ href, isExternalLink, hasUnderline, onClick, className = "", children }: LinkProps) {
  const cls = `${styles.link} ${hasUnderline ? styles.underline : ""} ${className}`;
  if (!href) return <button type="button" className={`${cls} ${styles.linkButton}`} onClick={onClick}>{children}</button>;
  if (isExternalLink || !href.startsWith("/")) {
    return <a href={href} className={cls} onClick={onClick} target={isExternalLink ? "_blank" : undefined} rel={isExternalLink ? "noopener noreferrer" : undefined}>{children}</a>;
  }
  return <NextLink href={href} className={cls} onClick={onClick}>{children}</NextLink>;
}

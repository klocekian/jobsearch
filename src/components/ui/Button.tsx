"use client";

import NextLink from "next/link";
import type { MouseEvent, ReactNode } from "react";
import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface ButtonProps {
  label: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  /** Shows only the icon; `label` stays the accessible name. */
  isIconOnly?: boolean;
  isDisabled?: boolean;
  tooltip?: string;
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  type?: "button" | "submit" | "reset";
  name?: string;
  value?: string;
  className?: string;
}

export function buttonClass({ variant = "secondary", size = "md", isIconOnly = false, className = "" }: Pick<ButtonProps, "variant" | "size" | "isIconOnly" | "className"> = {}) {
  return [styles.button, styles[variant], size !== "md" && styles[size], isIconOnly && styles.iconOnly, className].filter(Boolean).join(" ");
}

/** App routes navigate client-side; API routes and files are full page loads. */
const isAppRoute = (href: string) => href.startsWith("/") && !href.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(href.split("?")[0]);

export function Button({ label, variant, size, icon, isIconOnly, isDisabled, tooltip, href, onClick, type = "button", name, value, className }: ButtonProps) {
  const cls = buttonClass({ variant, size, isIconOnly, className });
  const content = <>{icon}{isIconOnly ? <span className={styles.srOnly}>{label}</span> : label}</>;
  if (href && !isDisabled) {
    return isAppRoute(href)
      ? <NextLink href={href} className={cls} title={tooltip} onClick={onClick}>{content}</NextLink>
      : <a href={href} className={cls} title={tooltip} onClick={onClick}>{content}</a>;
  }
  return (
    <button type={type} name={name} value={value} className={cls} title={tooltip} disabled={isDisabled} onClick={onClick}>
      {content}
    </button>
  );
}

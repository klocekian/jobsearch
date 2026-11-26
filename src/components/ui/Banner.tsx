"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/iconstack/Icon";
import { Tooltip } from "./Tooltip";
import styles from "./ui.module.css";

type Status = "info" | "success" | "warning" | "error";

interface BannerProps {
  status?: Status;
  title: ReactNode;
  description?: ReactNode;
  endContent?: ReactNode;
  isDismissable?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const ICONS: Record<Status, IconName> = { info: "info-circle", success: "circle-check", warning: "alert-triangle", error: "alert-circle" };

export function Banner({ status = "info", title, description, endContent, isDismissable, onDismiss, className = "" }: BannerProps) {
  return (
    <div role={status === "error" ? "alert" : "status"} className={`${styles.banner} ${styles[status]} ${className}`}>
      <Icon name={ICONS[status]} size={16} />
      <div className={styles.bannerText}>
        <div className={styles.bannerTitle}>{title}</div>
        {description && <div className={styles.bannerDescription}>{description}</div>}
      </div>
      {endContent && <div className={styles.bannerEnd}>{endContent}</div>}
      {isDismissable && (
        <Tooltip content="Dismiss">
          <button type="button" className={styles.bannerClose} onClick={onDismiss} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";
import styles from "./ui.module.css";

interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

/** A modal confirmation. Escape or the backdrop cancels; focus starts on Cancel. */
export function AlertDialog({ isOpen, onOpenChange, title, description, actionLabel, onAction }: AlertDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key !== "Tab" || !ref.current) return;
      const buttons = [...ref.current.querySelectorAll<HTMLButtonElement>("button")];
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;
  return (
    <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} className={styles.dialog}>
        <h2 id={titleId}>{title}</h2>
        <p id={descId}>{description}</p>
        <div className={styles.dialogActions}>
          <Button label="Cancel" variant="secondary" onClick={() => onOpenChange(false)} />
          <Button label={actionLabel} variant="primary" onClick={onAction} />
        </div>
      </div>
    </div>
  );
}

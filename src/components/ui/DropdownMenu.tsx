"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/iconstack/Icon";
import { buttonClass, type ButtonVariant } from "./Button";
import styles from "./ui.module.css";

interface DropdownMenuProps {
  button: { label: string; variant?: ButtonVariant; size?: "sm" | "md" | "lg"; isDisabled?: boolean };
  hasChevron?: boolean;
  items: { label: string; onClick: () => void }[];
}

export function DropdownMenu({ button, hasChevron, items }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div ref={root} className={styles.menuRoot}>
      <button
        type="button"
        className={buttonClass({ variant: button.variant, size: button.size })}
        disabled={button.isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {button.label}
        {hasChevron && <Icon name="chevron-down" size={13} />}
      </button>
      {open && (
        <div id={menuId} role="menu" className={styles.menu} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" className={styles.menuItem} onClick={() => { setOpen(false); item.onClick(); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

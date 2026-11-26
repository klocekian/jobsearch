"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/iconstack/Icon";
import styles from "./ui.module.css";

export interface SelectorOption {
  value: string;
  label: string;
  /** Drawn beside the option in the list and, once chosen, in the control. */
  icon?: ReactNode;
}

interface SelectorProps {
  label: string;
  isLabelHidden?: boolean;
  options: SelectorOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  startIcon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A select styled to match the text inputs. Native unless an option has an
 * icon, which a native list can't draw; then it is a listbox of its own.
 */
export function Selector(props: SelectorProps) {
  return props.options.some((o) => o.icon) ? <ListboxSelector {...props} /> : <NativeSelector {...props} />;
}

function NativeSelector({ label, isLabelHidden, options, value, onChange, placeholder, startIcon, size = "md", className = "" }: SelectorProps) {
  const id = useId();
  const hasPlaceholderOption = placeholder !== undefined && !options.some((o) => o.value === "");
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={isLabelHidden ? styles.srOnly : styles.fieldLabel}>{label}</label>
      <div className={`${styles.selectWrap} ${startIcon ? styles.hasStart : ""}`}>
        {startIcon && <span className={styles.selectStart}>{startIcon}</span>}
        <select id={id} className={`${styles.control} ${size === "sm" ? styles.controlSm : ""}`} value={value} onChange={(e) => onChange(e.target.value)}>
          {hasPlaceholderOption && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className={styles.selectChevron}><Icon name="chevron-down" size={14} /></span>
      </div>
    </div>
  );
}

/** The ARIA select-only combobox: focus stays on the control, arrows move the active option. */
function ListboxSelector({ label, isLabelHidden, options, value, onChange, placeholder, startIcon, size = "md", className = "" }: SelectorProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = options.find((o) => o.value === value);

  const show = (index = Math.max(0, options.findIndex((o) => o.value === value))) => { setActive(index); setOpen(true); };
  const choose = (index: number) => {
    setOpen(false);
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  };

  // Fixed to the viewport, so a scrolling table or pane can't clip it.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    const height = Math.min(options.length * 30 + 10, 300);
    const below = window.innerHeight - r.bottom > height + 8;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - height - 4), left: r.left, width: Math.max(r.width, 160) });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const dismiss = (e: Event) => { if (!list.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => setOpen(false),
      Tab: () => choose(active),
    };
    if (keys[e.key]) {
      if (e.key !== "Tab") e.preventDefault();
      keys[e.key]();
    } else if (e.key.length === 1) {
      const match = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const wrap = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (match >= 0 || wrap >= 0) setActive(match >= 0 ? match : wrap);
    }
  };

  const shownIcon = selected?.icon ?? startIcon;
  return (
    <div className={`${styles.field} ${className}`}>
      <span id={`${id}-label`} className={isLabelHidden ? styles.srOnly : styles.fieldLabel}>{label}</span>
      <div className={`${styles.selectWrap} ${shownIcon ? styles.hasStart : ""}`}>
        {shownIcon && <span className={styles.selectStart}>{shownIcon}</span>}
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          className={`${styles.control} ${styles.listboxTrigger} ${size === "sm" ? styles.controlSm : ""}`}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKeyDown}
        >
          <span className={selected ? undefined : styles.placeholder}>{selected?.label ?? placeholder ?? ""}</span>
        </button>
        <span className={styles.selectChevron}><Icon name="chevron-down" size={14} /></span>
      </div>
      {open && pos && createPortal(
        <div
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className={styles.listbox}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              className={styles.listboxOption}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => { choose(i); trigger.current?.focus(); }}
            >
              <span className={styles.listboxIcon}>{o.icon}</span>
              <span>{o.label}</span>
              {o.value === value && <Icon name="check" size={13} className={styles.listboxCheck} />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

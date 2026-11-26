"use client";

import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./ui.module.css";

type Handlers = {
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  "aria-describedby"?: string;
};

interface TooltipProps {
  content: ReactNode;
  /** One element that takes pointer and focus handlers (a button, link, or span). */
  children: ReactElement<Handlers>;
  side?: "top" | "bottom";
}

const DELAY = 350;
const GAP = 6;

/**
 * A styled tooltip for hover and keyboard focus, in place of the browser's
 * `title`. Describes the element it wraps; Escape hides it.
 */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const id = useId();
  // A hover waits DELAY before showing; keyboard focus shows at once.
  const [pending, setPending] = useState<{ rect: DOMRect; delay: number } | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tip = useRef<HTMLDivElement>(null);

  const show = (el: HTMLElement, delay: number) => setPending({ rect: el.getBoundingClientRect(), delay });
  const hide = useCallback(() => { setPending(null); setAnchor(null); setPos(null); }, []);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setAnchor(pending.rect), pending.delay);
    return () => clearTimeout(t);
  }, [pending]);

  // Above (or below) the anchor, kept inside the viewport.
  useLayoutEffect(() => {
    if (!anchor || !tip.current) return;
    const { width, height } = tip.current.getBoundingClientRect();
    const fitsAbove = anchor.top - height - GAP > 4;
    const above = side === "top" ? fitsAbove : window.innerHeight - anchor.bottom < height + GAP + 4;
    const left = Math.min(Math.max(4, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - 4);
    setPos({ top: above ? anchor.top - height - GAP : anchor.bottom + GAP, left });
  }, [anchor, side]);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", hide, true); };
  }, [anchor, hide]);

  if (content == null || content === "") return children;
  const own = children.props;
  const trigger = cloneElement(children, {
    "aria-describedby": [own["aria-describedby"], anchor ? id : null].filter(Boolean).join(" ") || undefined,
    onPointerEnter: (e: PointerEvent<HTMLElement>) => { own.onPointerEnter?.(e); if (e.pointerType !== "touch") show(e.currentTarget, DELAY); },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => { own.onPointerLeave?.(e); hide(); },
    onFocus: (e: FocusEvent<HTMLElement>) => { own.onFocus?.(e); if (e.currentTarget.matches(":focus-visible")) show(e.currentTarget, 0); },
    onBlur: (e: FocusEvent<HTMLElement>) => { own.onBlur?.(e); hide(); },
  });

  return (
    <>
      {trigger}
      {anchor && createPortal(
        <div ref={tip} id={id} role="tooltip" className={styles.tooltip} style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}>
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}

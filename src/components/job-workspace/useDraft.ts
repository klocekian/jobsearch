import { useState } from "react";

export interface Draft<T> {
  isOpen: boolean;
  value: T;
  set: (value: T) => void;
  open: (value: T) => void;
  close: () => void;
}

/**
 * An inline edit in progress. Held by the workspace rather than the panel
 * showing it, so switching tabs or panes doesn't throw away what was typed.
 */
export function useDraft<T>(empty: T): Draft<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [value, set] = useState<T>(empty);
  return {
    isOpen,
    value,
    set,
    open: (v) => { set(v); setIsOpen(true); },
    close: () => { setIsOpen(false); set(empty); },
  };
}

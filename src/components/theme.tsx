"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_KEY as KEY } from "@/lib/theme-script";

export type ThemePreference = "system" | "light" | "dark";

const EVENT = "theme-preference-change";

function readPreference(): ThemePreference {
  try {
    const p = localStorage.getItem(KEY);
    return p === "light" || p === "dark" ? p : "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved choice ("system" until one is made) and a setter that applies it at once. */
export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const set = useCallback((p: ThemePreference) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {}
    applyTheme(p);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [preference, set];
}

/** Follows the OS while the choice is "system", and other tabs' changes. Render once. */
export function ThemeSync() {
  const [preference] = useThemePreference();
  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);
  return null;
}

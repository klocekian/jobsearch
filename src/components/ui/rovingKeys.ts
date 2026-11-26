import type { KeyboardEvent } from "react";

/**
 * Left/Right (and Home/End) move between a row of options and select the one
 * reached. Only the selected option is in the Tab order (tabIndex 0).
 */
export function onRovingKeyDown(e: KeyboardEvent<HTMLElement>, onChange: (value: string) => void) {
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-value]:not(:disabled)")];
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const target = items[(next + items.length) % items.length];
  target.focus();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  onChange(target.dataset.value!);
}

"use client";

import { Icon, type IconName } from "@/components/iconstack/Icon";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/SegmentedControl";
import { Tooltip } from "@/components/ui/Tooltip";
import { useThemePreference, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "system", label: "System", icon: "device-desktop" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

/** System / Light / Dark, for Settings. */
export function ThemeSelector() {
  const [preference, setPreference] = useThemePreference();
  return (
    <SegmentedControl value={preference} onChange={(v) => setPreference(v as ThemePreference)} label="Theme">
      {OPTIONS.map((o) => (
        <SegmentedControlItem key={o.value} value={o.value} label={<span className="inline-flex items-center gap-1.5"><Icon name={o.icon} size={13} />{o.label}</span>} />
      ))}
    </SegmentedControl>
  );
}

/** One button that steps System → Light → Dark, for the sidebar. */
export function ThemeToggle({ className }: { className?: string }) {
  const [preference, setPreference] = useThemePreference();
  const i = OPTIONS.findIndex((o) => o.value === preference);
  const current = OPTIONS[i];
  const next = OPTIONS[(i + 1) % OPTIONS.length];
  return (
    <Tooltip content={`Theme: ${current.label}. Switch to ${next.label.toLowerCase()}`}>
      <button type="button" className={className} aria-label={`Theme: ${current.label}`} onClick={() => setPreference(next.value)}>
        <Icon name={current.icon} size={16} />
      </button>
    </Tooltip>
  );
}

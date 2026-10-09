"use client";

export function WithAiToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary rounded cursor-pointer"
      />
      <span>with AI</span>
    </label>
  );
}

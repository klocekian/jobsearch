/** The Fieldlines star, as in the favicon (src/app/icon.png). */
export function BrandMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="12" fill="var(--color-brand, #e9090a)" />
      <polygon fill="#fff" points="12.00,4.00 13.94,9.93 20.18,9.94 15.14,13.62 17.05,19.56 12.00,15.90 6.95,19.56 8.86,13.62 3.82,9.94 10.06,9.93" />
    </svg>
  );
}

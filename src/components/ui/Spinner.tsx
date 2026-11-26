import styles from "./ui.module.css";

export function Spinner({ label = "Loading…", size = "md" }: { label?: string; size?: "sm" | "md" }) {
  return (
    <span role="status" className={`${styles.spinner} ${size === "sm" ? styles.sm : ""}`}>
      <span className={styles.spinnerRing} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}

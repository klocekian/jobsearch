import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./page.module.css";

interface PageProps {
  title: string;
  /** Shown before the title, linked when it has an href. */
  crumb?: { label: string; href?: string };
  actions?: ReactNode;
  /** Caps the content width, for forms and settings. */
  narrow?: boolean;
  children: ReactNode;
}

/** A page in the app shell: a sticky header with title and actions over the content. */
export function Page({ title, crumb, actions, narrow, children }: PageProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>
          {crumb && (crumb.href ? <Link href={crumb.href} className={styles.crumb}>{crumb.label} /</Link> : <span className={styles.crumb}>{crumb.label} /</span>)}
          <h1>{title}</h1>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={`${styles.content} ${narrow ? styles.narrow : ""}`}>{children}</div>
    </main>
  );
}

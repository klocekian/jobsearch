"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PHASES, searchPhase } from "@/lib/search-workflow";
import styles from "./search.module.css";

export function SearchNav({ name }: { name: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = params.get("view");
  const phase = searchPhase(pathname.startsWith("/jobs/") ? view === "application" ? "applications" : view === "prepare" ? "prepare" : "explore" : params.get("phase"));
  const inSearch = pathname.startsWith("/jobs") && view !== "tracker" && !params.has("add");
  return <aside className={styles.nav}>
    <div className={styles.brandRow}><Link href="/jobs" className={styles.brand} aria-label="Fieldlines job search home"><span className={styles.brandMark} aria-hidden="true">f</span>fieldlines</Link><Link href="/profile" aria-label="Settings" className={styles.mobileSettings}><NavIcon kind="settings" /></Link></div>
    <div className={styles.workspaceLabel}><span className={styles.workspaceDot} />My job search</div>
    <p className={styles.navCaption}>WORKSPACE</p>
    <nav className={styles.navLinks} aria-label="Search phases">
      {PHASES.map((item) => <Link key={item.id} href={`/jobs?phase=${item.id}`} aria-current={inSearch && phase === item.id ? "page" : undefined}><NavIcon kind={item.id} /><span>{item.label}</span></Link>)}
    </nav>
    <div className={styles.navUtilities}>
      <p className={styles.navCaption}>LIBRARY</p>
      <Link href="/jobs?view=tracker" aria-current={view === "tracker" ? "page" : undefined}><NavIcon kind="tracker" />All jobs & archive</Link>
      <Link href="/profile?tab=extension"><NavIcon kind="capture" />Capture extension</Link>
    </div>
    <div className={styles.navBottom}>
      <Link className={styles.navSettings} href="/profile" aria-current={pathname === "/profile" ? "page" : undefined}><NavIcon kind="settings" />Settings</Link>
      <div className={styles.account}><span className={styles.avatar}>{name.charAt(0).toUpperCase()}</span><span>{name}<small>Personal workspace</small></span></div>
    </div>
  </aside>;
}

function NavIcon({ kind }: { kind: string }) {
  const paths: Record<string, React.ReactNode> = {
    explore: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    prepare: <><path d="M7 3h8l4 4v14H5V3h2Zm7 0v5h5M8 12h8M8 16h6" /></>,
    applications: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 5V3h8v2M3 11h18M10 11v3h4v-3" /></>,
    tracker: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></>,
    capture: <><path d="M9 3H4v18h16v-5M13 3h8v8M10 14 21 3" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" fill="currentColor" /><circle cx="15" cy="17" r="2.5" fill="currentColor" /></>,
  };
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

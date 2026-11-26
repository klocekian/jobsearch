"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/iconstack/Icon";
import { usePathname, useSearchParams } from "next/navigation";
import { PHASES, searchPhase } from "@/lib/search-workflow";
import type { AiConnection } from "@/components/Nav";
import { BrandMark } from "@/components/BrandMark";
import styles from "./search.module.css";

export function SearchNav({ name, aiStatus }: { name: string; aiStatus: AiConnection }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = params.get("view");
  const phase = searchPhase(pathname.startsWith("/jobs/") ? view === "application" ? "applications" : view === "prepare" ? "prepare" : "explore" : params.get("phase"));
  const inSearch = pathname.startsWith("/jobs") && view !== "tracker" && !params.has("add");
  return <aside className={styles.nav}>
    <div className={styles.brandRow}><Link href="/jobs" className={styles.brand} aria-label="Fieldlines job search home"><BrandMark className={styles.brandMark} />fieldlines</Link><Link href="/profile" aria-label="Settings" className={styles.mobileSettings}><NavIcon kind="settings" /></Link></div>
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
      <Link href="/profile?tab=ai" className={styles.account} title={aiStatus.label}><span className={styles.avatar}>{name.charAt(0).toUpperCase()}</span><span>{name}<small><span className={styles.aiDot} data-connected={aiStatus.connected} aria-hidden="true" />{aiStatus.label}</small></span></Link>
    </div>
  </aside>;
}

const navIcons = {
  explore: "search",
  prepare: "file-pencil",
  applications: "briefcase",
  tracker: "table",
  capture: "puzzle",
  settings: "settings",
} satisfies Record<string, IconName>;

function NavIcon({ kind }: { kind: keyof typeof navIcons }) {
  return <Icon name={navIcons[kind]} size={17} />;
}

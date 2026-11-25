"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PHASES, searchPhase } from "@/lib/search-workflow";
import styles from "./search.module.css";

export function SearchNav({ name }: { name: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const phase = searchPhase(params.get("phase"));
  const inSearch = pathname === "/jobs" && !params.has("add");
  return <header className={styles.nav}>
    <Link href="/jobs" className={styles.brand} aria-label="Fieldlines job search home"><span className={styles.brandMark} aria-hidden="true">f.</span><span>fieldlines<span className={styles.brandSub}>YOUR NEXT CHAPTER</span></span></Link>
    <nav className={styles.navLinks} aria-label="Search phases">
      {PHASES.map((item, i) => <Link key={item.id} href={`/jobs?phase=${item.id}`} aria-current={inSearch && phase === item.id ? "page" : undefined}><span className={styles.navNumber}>0{i + 1}</span>{item.label}</Link>)}
    </nav>
    <Link href="/profile" className={styles.account} aria-label={`Account and settings for ${name}`}><span className={styles.avatar}>{name.charAt(0).toUpperCase()}</span><span>Settings</span></Link>
  </header>;
}

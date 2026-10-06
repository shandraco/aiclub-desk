"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./library.module.css";

const TABS = [
  { href: "/library/speakers", label: "Speakers" },
  { href: "/library/partners", label: "Partners" },
  { href: "/library/rooms", label: "Rooms" },
] as const;

/** Sections of the library as links (each is its own page), marked with aria-current. */
export function LibraryTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Library sections" className={styles.tabs}>
      <ul>
        {TABS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={styles.tab} aria-current={path.startsWith(t.href) ? "page" : undefined}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

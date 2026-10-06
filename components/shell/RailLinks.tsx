"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { icons, type IconName } from "./icons";
import styles from "./Rail.module.css";

export function RailLinks({ items }: { items: readonly { href: string; label: string; icon: IconName }[] }) {
  const pathname = usePathname();
  return (
    <ul className={styles.links}>
      {items.map(({ href, label, icon }) => {
        const current = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link href={href as Route} className={styles.link} aria-current={current ? "page" : undefined}>
              <span className={styles.icon}>{icons[icon]}</span>
              <span className={styles.label}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

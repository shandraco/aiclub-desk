import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import type { User } from "@/lib/auth/session";
import { CommandBar } from "./CommandBar";
import { RailLinks } from "./RailLinks";
import { ThemeChoice } from "./ThemeChoice";
import styles from "./Rail.module.css";

export const NAV = [
  { href: "/", label: "Week", icon: "week" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/events", label: "Events", icon: "events" },
  { href: "/posts", label: "Posts", icon: "posts" },
  { href: "/templates", label: "Templates", icon: "templates" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/results", label: "Results", icon: "results" },
] as const;

/**
 * The studio's left rail (a bottom bar on phones): sections, search, and you.
 * Replaces the original desk's header of buttons.
 */
export function Rail({ user }: { user: User }) {
  const items = user.role === "admin" ? [...NAV, { href: "/team", label: "Team", icon: "team" } as const] : NAV;
  return (
    <header className={styles.rail}>
      <Link href="/" className={styles.mark} aria-label="Content desk, this week">
        <svg viewBox="0 0 144 144" aria-hidden="true"><path d="M72 0C72 32 112 72 144 72C112 72 72 112 72 144C72 112 32 72 0 72C32 72 72 32 72 0Z" /></svg>
      </Link>
      <nav aria-label="Main" className={styles.nav}>
        <RailLinks items={items} />
      </nav>
      <div className={styles.foot}>
        <CommandBar />
        <details className={styles.me}>
          <summary className={styles.avatar} aria-label={`Your menu, ${user.displayName}`}>
            {user.displayName.slice(0, 1).toUpperCase()}
          </summary>
          <div className={styles.menu}>
            <p className={styles.menuHead}>
              <b>{user.displayName}</b>
              <span>@{user.username} · {user.role}</span>
            </p>
            <Link href="/account" className={styles.menuItem}>Your account</Link>
            {user.role === "admin" ? <Link href="/team" className={styles.menuItem}>Team and invites</Link> : null}
            <ThemeChoice />
            <form action={signOut}>
              <button type="submit" className={styles.menuItem}>Sign out</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}

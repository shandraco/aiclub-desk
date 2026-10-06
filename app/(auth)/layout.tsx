import type { ReactNode } from "react";
import styles from "./auth.module.css";

/** Sign-in and invite pages: the club's black ground on one side, the form on the other. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.brand} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-white.png" alt="" width={1400} height={488} className={styles.logo} />
        <p className={styles.mark}>
          <svg viewBox="0 0 144 144" className={styles.spark}><path d="M72 0C72 32 112 72 144 72C112 72 72 112 72 144C72 112 32 72 0 72C32 72 72 32 72 0Z" /></svg>
          Content desk
        </p>
      </aside>
      <main id="main" className={styles.main}>
        <div className={styles.form}>{children}</div>
      </main>
    </div>
  );
}

import Link from "next/link";
import type { Route } from "next";
import styles from "./library.module.css";

/**
 * Search and the active/archived switch for a library list. A plain GET form, so it works
 * before JavaScript loads and the URL can be shared.
 */
export function Toolbar({
  base,
  q,
  archived,
  noun,
  archivedCount,
  children,
}: {
  base: string;
  q: string;
  archived: boolean;
  noun: string;
  archivedCount: number;
  children?: React.ReactNode;
}) {
  const link = (show: boolean) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (show) sp.set("show", "archived");
    const s = sp.toString();
    return (s ? `${base}?${s}` : base) as Route;
  };
  return (
    <div className={styles.toolbar}>
      <form role="search" method="get" action={base} className={styles.search}>
        <label htmlFor="lib-q" className="visually-hidden">Search {noun}</label>
        <input id="lib-q" name="q" type="search" className="input" placeholder={`Search ${noun}`} defaultValue={q} key={q} />
        {archived ? <input type="hidden" name="show" value="archived" /> : null}
        <button type="submit" className="btn">Search</button>
        {q ? <Link href={link(archived)} className="btn btn-quiet">Clear</Link> : null}
      </form>
      <p className={styles.show}>
        {archived ? (
          <>
            Showing archived. <Link href={link(false)}>Show active {noun}</Link>
          </>
        ) : archivedCount > 0 ? (
          <Link href={link(true)}>
            {archivedCount} archived
          </Link>
        ) : null}
      </p>
      {children ? <div className={styles.add}>{children}</div> : null}
    </div>
  );
}

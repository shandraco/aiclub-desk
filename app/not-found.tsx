import type { Metadata } from "next";
import Link from "next/link";
import styles from "./status-page.module.css";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className={`wrap ${styles.page}`}>
      <h1>That page isn’t here</h1>
      <p>It may have been deleted, or the link is wrong. Posts and events that someone deleted can’t be brought back.</p>
      <div className="btn-row">
        <Link href="/" className="btn btn-primary">Go to this week</Link>
      </div>
    </div>
  );
}

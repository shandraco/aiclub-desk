"use client";

import type { Issue } from "@/lib/brand/checks";
import styles from "./editor.module.css";

/**
 * The brand check: errors ("Fix") first, then warnings ("Check"), numbered like the markers on
 * the canvas. Each one selects its element and opens it for editing.
 */
export function ChecksPanel({ issues, onGo }: { issues: Issue[]; onGo: (path: string) => void }) {
  const errors = issues.filter((i) => i.level === "error").length;
  return (
    <section className="panel" aria-labelledby="checks-h">
      <h2 id="checks-h">
        Brand check
        <small>{issues.length ? `${errors} to fix, ${issues.length - errors} to check` : "On brand"}</small>
      </h2>
      {issues.length ? (
        <ol className={styles.issueList}>
          {issues.map((i, n) => (
            <li key={`${i.path}-${n}`}>
              <button type="button" className={styles.issueBtn} onClick={() => onGo(i.path)}>
                <span className={styles.issueNum}>{n + 1}</span>
                <b className={i.level === "error" ? styles.fix : styles.check}>{i.level === "error" ? "Fix" : "Check"}</b>
                <span>{i.text}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.hint}>Nothing to fix. The words, photos and captions follow the brand guide.</p>
      )}
    </section>
  );
}

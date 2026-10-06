"use client";

import styles from "./status-page.module.css";

/** Whole-page failure: plain words, a way forward, and a reference to quote. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={`wrap ${styles.page}`}>
      <h1>The desk couldn’t load this page</h1>
      <p>Try again in a moment. Anything you saved before this is safe; a change you were typing may not have saved.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>Try again</button>
      </div>
      {error.digest ? <p className="muted">If it keeps happening, send an admin this reference: {error.digest}.</p> : null}
    </div>
  );
}

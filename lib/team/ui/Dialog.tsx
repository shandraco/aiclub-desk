"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * A modal <dialog class="dlg">, mounted only while open. showModal() traps focus and gives
 * Escape for free; on close, focus goes back to whatever opened it.
 */
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  // Whatever had focus when the dialog first rendered (the button that opened it). Read at
  // render time: by the time effects run, focus may already be inside the dialog.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      // Start on the field marked data-autofocus, else showModal's default (the first control).
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    // No close() here: in dev Strict Mode the effect is torn down and re-run, and close()
    // would fire the close event and shut the dialog straight away. Unmounting removes it.
    return () => {
      opener?.focus?.();
    };
  }, [opener]);

  return (
    <dialog
      ref={ref}
      className={`dlg ${styles.dialog} ${wide ? styles.wide : ""}`}
      aria-labelledby={titleId}
      onClose={() => closeRef.current()}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
    >
      <div className={styles.dlgHead}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-quiet btn-s" onClick={() => closeRef.current()}>
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

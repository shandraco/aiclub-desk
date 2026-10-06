"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/actions";
import ui from "./ui.module.css";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * A one-button form for a server action (add a plan step, restore an event). Shows the
 * action's message under the button when it fails.
 */
export function ActionButton({ action, fields, children, className = "btn btn-s", pendingLabel }: { action: Action; fields: Record<string, string>; children: ReactNode; className?: string; pendingLabel?: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={run}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {state.message && !state.ok ? (
        <p role="alert" className={ui.actionError}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * A button that asks before it acts: opens a dialog that says what will happen, with the
 * confirming button inside a form posting to the server action.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  body,
  confirmLabel,
  danger = false,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useEffect(() => {
    if (state.ok) ref.current?.close();
  }, [state]);
  return (
    <>
      <button type="button" className={`btn btn-s ${danger ? "btn-danger" : ""}`} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} className="dlg" aria-labelledby={titleId}>
        <h2 id={titleId} className={ui.dlgTitle}>{title}</h2>
        <div className={ui.dlgBody}>{body}</div>
        {state.message && !state.ok ? <p role="alert" className={`notice notice-danger ${ui.dlgNotice}`}>{state.message}</p> : null}
        <form action={run} className="btn-row">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button type="submit" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
            Keep it
          </button>
        </form>
      </dialog>
    </>
  );
}

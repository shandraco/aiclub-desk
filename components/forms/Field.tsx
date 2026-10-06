import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/**
 * A labelled control with its hint and error tied on by aria-describedby. Server actions
 * return `errors: Record<name, message>`; pass errors[name] as `error`.
 */
interface Common {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  error?: string;
  id?: string;
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

function Parts({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint ? <span id={`${id}-hint`} className="hint">{hint}</span> : null}
      {error ? (
        <span id={`${id}-error`} className="error">
          <span className="visually-hidden">Error: </span>
          {error}
        </span>
      ) : null}
    </>
  );
}

export function TextField({ label, name, hint, error, id = `f-${name}`, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} {...rest} />
      <Parts id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ label, name, hint, error, id = `f-${name}`, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} className={`input ${className ?? ""}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} {...rest} />
      <Parts id={id} hint={hint} error={error} />
    </div>
  );
}

/** Form-level message: shown above the submit button, announced when it changes. */
export function FormMessage({ message, tone = "danger" }: { message?: string; tone?: "danger" | "plain" }) {
  return (
    <div role="status" aria-live="polite">
      {message ? <p className={tone === "danger" ? "notice notice-danger" : "notice"}>{message}</p> : null}
    </div>
  );
}

import "server-only";
import type { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/session";
import { log } from "@/lib/log";

/**
 * The shape every form action returns to useActionState: a message for the form, errors by
 * field name, and the values to put back so nothing typed is lost.
 */
export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = issue.path.join(".");
    if (k && !out[k]) out[k] = issue.message;
  }
  return out;
}

export function formValues(fd: FormData, skip: string[] = ["password", "confirm"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !skip.includes(k) && !k.startsWith("$")) out[k] = v;
  return out;
}

/** Turns auth failures into a form message and logs anything unexpected. Never swallows redirects. */
export function failure(err: unknown, where: string): FormState {
  if (err instanceof UnauthorizedError) return { message: "Your session ended. Sign in again, then retry." };
  if (err instanceof ForbiddenError) return { message: err.message };
  if (err instanceof UserError) return { message: err.message };
  log.error("action failed", { where, error: err instanceof Error ? err : new Error(String(err)) });
  return { message: "That didn’t save because of a problem on our side. Try again; if it repeats, tell an admin." };
}

/** An error whose message is safe and useful to show the person who caused it. */
export class UserError extends Error {
  override name = "UserError";
}

/** Next's redirect()/notFound() throw; let them through any try/catch. */
export function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}

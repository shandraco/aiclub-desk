"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { savePost } from "@/app/(desk)/posts/[id]/actions";
import { fromLocalInput } from "@/lib/time";
import type { Draft } from "./types";

export type SaveState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

const DELAY = 800;

/**
 * Debounced autosave with optimistic concurrency. Saves run one at a time (each reads the
 * version the previous one returned), the local draft is never replaced by a response, and a
 * conflict stops saving until the person chooses to load the other version.
 */
export function useAutosave(postId: string, initialVersion: number, getDraft: () => Draft, onSaved?: () => void, onFailed?: (message: string) => void) {
  const version = useRef(initialVersion);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const saved = useRef(onSaved);
  const failed = useRef(onFailed);
  useEffect(() => {
    saved.current = onSaved;
    failed.current = onFailed;
  });

  const run = useCallback((): Promise<void> => {
    queue.current = queue.current.then(async () => {
      if (!dirty.current || blocked.current) return;
      dirty.current = false;
      const d = getDraft();
      setState({ kind: "saving" });
      const sched = d.scheduled ? fromLocalInput(d.scheduled) : null;
      const res = await savePost({
        postId,
        version: version.current,
        patch: { slides: d.slides, captions: d.captions, formats: d.formats, channels: d.channels, scheduledFor: sched ? sched.toISOString() : null, kind: d.kind },
      }).catch(() => ({ ok: false as const, message: "Couldn’t reach the desk. Your changes are still here; they’ll save when the connection is back.", conflict: false }));
      if (res.ok) {
        if (res.version) version.current = res.version;
        saved.current?.();
        setState(dirty.current ? { kind: "pending" } : { kind: "saved" });
      } else {
        dirty.current = true;
        failed.current?.(res.message);
        if (res.conflict) {
          blocked.current = true;
          setState({ kind: "conflict", message: res.message });
        } else {
          setState({ kind: "error", message: res.message });
        }
      }
    });
    return queue.current;
  }, [getDraft, postId]);

  const schedule = useCallback(() => {
    dirty.current = true;
    if (blocked.current) return;
    setState({ kind: "pending" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), DELAY);
  }, [run]);

  /** Saves now and waits. True when everything on screen is saved. */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await run();
    return !dirty.current && !blocked.current;
  }, [run]);

  const block = useCallback((message: string) => {
    blocked.current = true;
    setState({ kind: "conflict", message });
  }, []);

  // Leaving the page with edits pending: save on the way out (in-app navigation) and ask the
  // browser to confirm (closing the tab or reloading).
  const skipGuard = useRef(false);
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (skipGuard.current || !dirty.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && !blocked.current) void run();
    };
  }, [run]);

  const isDirty = useCallback(() => dirty.current, []);
  const getVersion = useCallback(() => version.current, []);
  const setVersion = useCallback((v: number) => {
    version.current = v;
  }, []);
  /** Lets the page unload without the "unsaved changes" prompt (after choosing to discard). */
  const allowLeave = useCallback(() => {
    skipGuard.current = true;
  }, []);
  return useMemo(
    () => ({ state, schedule, flush, block, isDirty, getVersion, setVersion, allowLeave }),
    [state, schedule, flush, block, isDirty, getVersion, setVersion, allowLeave],
  );
}

"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { heartbeat, leave, type Here } from "@/app/(desk)/posts/[id]/actions";
import { PostCanvas } from "@/components/post/PostCanvas";
import { Spark } from "@/components/Spark";
import { StatusWord } from "@/components/StatusWord";
import { blankFields, KIND_LABEL } from "@/lib/brand/presets";
import { checkPost, type Issue } from "@/lib/brand/checks";
import { newSlideId, nextSlide, renumber } from "@/lib/posts/factory";
import { FAMILY_LABEL, FORMAT_LABEL, SIZES, TEMPLATES, type FamilyKey, type Format, type ImageRef, type Slide, type SlideFields, type TemplateKey } from "@/lib/posts/types";
import { GROUNDS } from "./Inspector";
import { fmtDateTime, fromLocalInput, relativeDay, toLocalInput } from "@/lib/time";
import { CanvasEditor, type Selection } from "./CanvasEditor";
import { CaptionsPanel } from "./CaptionsPanel";
import { ChecksPanel } from "./ChecksPanel";
import { CropDialog, type CropTarget } from "./CropDialog";
import { ExportBar } from "./ExportBar";
import { fid } from "./fields";
import { Inspector } from "./Inspector";
import { LayoutProbe, type ProbeResult } from "./LayoutProbe";
import { ReviewPanel } from "./ReviewPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SlideStrip } from "./SlideStrip";
import { getImage, setImage } from "./slots";
import { getText, issueTarget, PLACEHOLDER, setText, targetPath, textLabel } from "./targets";
import type { ActivityItem, Draft, EditorPost, LibPartner, LibSpeaker, Me, Person, UploadMode } from "./types";
import { useAutosave, type SaveState } from "./useAutosave";
import styles from "./editor.module.css";

const COMMON: (keyof SlideFields)[] = ["ground", "series", "kicker", "headline", "dek", "meta", "cta", "page", "partners", "partnerPlace", "partnerLabel"];
type Pane = "captions" | "checks" | "review" | "schedule";
const PANES: [Pane, string][] = [
  ["captions", "Captions"],
  ["checks", "Checks"],
  ["review", "Review"],
  ["schedule", "Schedule"],
];

const draftOf = (p: EditorPost): Draft => ({
  slides: p.slides,
  captions: p.captions,
  formats: p.formats,
  channels: p.channels,
  scheduled: toLocalInput(p.scheduledFor),
  kind: p.kind,
});
const sameContent = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches("input, textarea, select") || el.isContentEditable);

const SHORTCUTS: [string, string][] = [
  ["Tab, Shift+Tab", "Move between elements on the graphic"],
  ["Enter", "Edit the focused text in place, or select a photo"],
  ["Escape", "Finish editing"],
  ["Arrow keys on a photo", "Move the photo in its frame (Shift for bigger steps)"],
  ["+ and − on a photo", "Zoom the photo"],
  ["← and →", "Previous and next slide"],
  ["Alt+← and Alt+→ on a slide thumbnail", "Move the slide"],
  ["⌘Z or Ctrl+Z", "Undo"],
  ["⇧⌘Z or Ctrl+Y", "Redo"],
  ["⌘S or Ctrl+S", "Save now"],
  ["?", "Show these shortcuts"],
];

function SaveWord({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const bad = state.kind === "error" || state.kind === "conflict";
  return (
    <span className={`${styles.save} ${bad ? styles.errText : ""}`}>
      {state.kind === "pending" || state.kind === "saving" ? "Saving…" : bad ? "Not saved" : "Saved"}
      {state.kind === "error" ? (
        <button type="button" className="btn btn-s btn-quiet" onClick={onRetry} title={state.message}>
          Try again
        </button>
      ) : null}
    </span>
  );
}

export function Editor({
  post,
  me,
  names,
  approvers,
  activity,
  speakers,
  partners,
  uploadMode,
  present,
}: {
  post: EditorPost;
  me: Me;
  names: Record<string, string>;
  approvers: Person[];
  activity: ActivityItem[];
  speakers: LibSpeaker[];
  partners: LibPartner[];
  uploadMode: UploadMode;
  present: Here[];
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(post));
  const draftRef = useRef(draft);
  const getDraft = useCallback(() => draftRef.current, []);
  const [savedHere, setSavedHere] = useState(false);
  const [said, setSaid] = useState("");
  const say = useCallback((text: string) => setSaid((prev) => (prev === text ? `${text} ` : text)), []);
  const save = useAutosave(
    post.id,
    post.version,
    getDraft,
    () => {
      setSavedHere(true);
      say("Saved.");
    },
    (message) => say(`Not saved. ${message}`),
  );
  const readOnly = post.status === "posted";

  // A refresh after a review action brings the new version; adopt it when the words match.
  useEffect(() => {
    if (post.version > save.getVersion() && !save.isDirty() && sameContent(draftOf(post), draftRef.current)) save.setVersion(post.version);
  }, [post, save]);

  /* ---------------- changes, undo and redo ---------------- */
  const undoStack = useRef<Draft[]>([]);
  const redoStack = useRef<Draft[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);

  const apply = useCallback(
    (next: Draft) => {
      draftRef.current = next;
      setDraft(next);
      save.schedule();
    },
    [save],
  );

  /** Every edit goes through here. Edits to the same thing within 1.5 s undo as one step. */
  const update = useCallback(
    (fn: (d: Draft) => Draft, key?: string) => {
      if (readOnly) return;
      const prev = draftRef.current;
      const next = fn(prev);
      if (next === prev) return;
      const now = Date.now();
      const same = key && lastKey.current?.key === key && now - lastKey.current.at < 1500;
      if (!same) {
        undoStack.current.push(prev);
        if (undoStack.current.length > 200) undoStack.current.shift();
      }
      lastKey.current = key ? { key, at: now } : null;
      redoStack.current = [];
      apply(next);
    },
    [readOnly, apply],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return say("Nothing to undo.");
    redoStack.current.push(draftRef.current);
    lastKey.current = null;
    apply(prev);
    say("Undone.");
  }, [apply, say]);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return say("Nothing to redo.");
    undoStack.current.push(draftRef.current);
    lastKey.current = null;
    apply(next);
    say("Redone.");
  }, [apply, say]);

  /* ---------------- slides and selection ---------------- */
  const [sel, setSel] = useState(0);
  const idx = Math.min(sel, draft.slides.length - 1);
  const slide = draft.slides[idx]!;
  const [fmt, setFmt] = useState<Format>(post.formats[0] ?? "feed");
  const allowed = TEMPLATES[slide.template].formats;
  const shown: Format = allowed.includes(fmt) ? fmt : allowed[0]!;
  const [allFormats, setAllFormats] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "slide" });
  const [editing, setEditing] = useState<string | null>(null);

  const goSlide = useCallback((i: number) => {
    setSel(i);
    setSelection({ kind: "slide" });
    setEditing(null);
  }, []);

  const setSlides = (fn: (s: Slide[]) => Slide[], key?: string) => update((d) => ({ ...d, slides: fn(d.slides) }), key);
  const fieldsAt = (i: number, fn: (f: SlideFields) => SlideFields, key?: string) =>
    setSlides((list) => list.map((s, k) => (k === i ? { ...s, fields: fn(s.fields) } : s)), key === undefined ? undefined : `${i}:${key}`);
  const imageAt = (i: number, slot: string, img: ImageRef | null) => fieldsAt(i, (f) => setImage(f, slot, img), `photo:${slot}`);

  /** Opens the in-place editor; an empty field gets a placeholder, selected, so typing replaces it. */
  function openText(i: number, key: string) {
    if (readOnly) return;
    const f = draftRef.current.slides[i]?.fields;
    if (!f) return;
    if (!getText(f, key).trim()) fieldsAt(i, (x) => setText(x, key, PLACEHOLDER[key] ?? textLabel(key)), key);
    if (i !== idx) setSel(i);
    setSelection({ kind: "text", key });
    setEditing(key);
  }
  const focusAfter = useRef<string | null>(null);
  function closeText(opts?: { returnFocus?: boolean }) {
    if (opts?.returnFocus) focusAfter.current = editing;
    setEditing(null);
  }
  // After the in-place editor closes from the keyboard, put focus back on what was edited.
  useEffect(() => {
    const key = focusAfter.current;
    if (editing || !key) return;
    focusAfter.current = null;
    (document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? document.querySelector<HTMLElement>("[data-key]"))?.focus();
  }, [editing]);

  function changeTemplate(t: TemplateKey) {
    setSlides((list) =>
      list.map((s, k) => {
        if (k !== idx || s.template === t) return s;
        const fields = blankFields(t);
        for (const key of COMMON) if (s.fields[key] !== undefined) (fields as unknown as Record<string, unknown>)[key] = s.fields[key];
        return { ...s, template: t, fields };
      }),
    );
    say(`Slide ${idx + 1} is now ${TEMPLATES[t].name}.`);
  }
  function changeFamily(fam: FamilyKey) {
    setSlides((list) =>
      list.map((s, k) => {
        if (k !== idx || (s.family ?? "classic") === fam) return s;
        // Keep the ground if the new family draws it; otherwise its first ground.
        const ground = GROUNDS[fam].some(([g]) => g === s.fields.ground) ? s.fields.ground : GROUNDS[fam][0]![0];
        return { ...s, family: fam, fields: { ...s.fields, ground } };
      }),
    );
    say(`Slide ${idx + 1} is now drawn in ${FAMILY_LABEL[fam].split(":")[0]}.`);
  }
  function addSlide(t: TemplateKey | undefined) {
    setSlides((list) => renumber([...list.slice(0, idx + 1), nextSlide(list[idx]!, t), ...list.slice(idx + 1)]));
    goSlide(idx + 1);
    say(`Added slide ${idx + 2}.`);
  }
  function duplicateSlide(i: number) {
    setSlides((list) => renumber([...list.slice(0, i + 1), { ...structuredClone(list[i]!), id: newSlideId() }, ...list.slice(i + 1)]));
    goSlide(i + 1);
    say(`Copied slide ${i + 1}.`);
  }
  function deleteSlide(i: number) {
    setSlides((list) => renumber(list.filter((_, k) => k !== i)));
    goSlide(Math.max(0, i - 1));
    say(`Deleted slide ${i + 1}. Undo brings it back.`);
  }
  function reorder(from: number, to: number) {
    setSlides((list) => {
      const out = [...list];
      const [s] = out.splice(from, 1);
      out.splice(to, 0, s!);
      return renumber(out);
    });
    setSel(to);
    say(`Moved slide ${from + 1} to position ${to + 1}.`);
  }

  /* ---------------- checks ---------------- */
  const brand = useMemo(() => checkPost(draft.slides, draft.captions, draft.channels), [draft.slides, draft.captions, draft.channels]);
  const [probe, setProbe] = useState<ProbeResult>({ issues: [], frames: {} });
  const probeSlides = useDeferredValue(draft.slides);
  const probeFormats = useMemo(() => [...new Set<Format>([...draft.formats, shown])], [draft.formats, shown]);
  const issues: Issue[] = useMemo(() => {
    const all = [...brand, ...probe.issues];
    return [...all.filter((i) => i.level === "error"), ...all.filter((i) => i.level === "warn")];
  }, [brand, probe.issues]);
  const issueNumber = useCallback((i: Issue) => issues.indexOf(i) + 1, [issues]);
  const issuesFor = useCallback((path: string) => issues.filter((i) => i.path === path), [issues]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const frames = useMemo(() => {
    const out: Record<string, { w: number; h: number }> = {};
    const prefix = `${idx}:${shown}:`;
    for (const [k, v] of Object.entries(probe.frames)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    return out;
  }, [probe.frames, idx, shown]);

  // Say what the check thinks of the field being typed, when that changes.
  const editingIssues = editing ? issuesFor(targetPath(idx, editing)).map((i) => i.text).join(" ") : "";
  const lastSaid = useRef("");
  useEffect(() => {
    if (editingIssues && editingIssues !== lastSaid.current) say(editingIssues);
    lastSaid.current = editingIssues;
  }, [editingIssues, say]);

  /* ---------------- panes ---------------- */
  const [pane, setPane] = useState<Pane | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  function goTo(path: string) {
    const t = issueTarget(path);
    if (!t) return;
    if (t.pane === "captions") {
      setPane("captions");
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(fid(t.field!))?.focus()));
      return;
    }
    setAllFormats(false);
    setInspectorOpen(true);
    if (t.text) return openText(t.slide, t.text);
    setSel(t.slide);
    setEditing(null);
    if (t.photo) {
      setSelection({ kind: "photo", slot: t.photo });
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-key="photo:${CSS.escape(t.photo!)}"]`)?.focus()));
    } else if (t.partner !== undefined) setSelection({ kind: "partner", i: t.partner });
    else setSelection({ kind: "slide" });
  }

  /* ---------------- crop ---------------- */
  const [crop, setCrop] = useState<(CropTarget & { slide: number }) | null>(null);
  const openCrop = (slot: string, frame?: { w: number; h: number }) => {
    const f = frame ?? frames[slot];
    if (!f) return;
    const [list, n] = slot.split(".");
    setCrop({ key: slot, slide: idx, frame: f, formatName: FORMAT_LABEL[shown].toLowerCase(), label: list === "speakers" ? `Speaker ${Number(n) + 1} photo` : `Photo ${Number(n) + 1}` });
  };
  const cropImg = crop ? getImage(draft.slides[crop.slide]?.fields ?? slide.fields, crop.key) : null;

  /* ---------------- presence ---------------- */
  const [here, setHere] = useState<Here[]>(present);
  useEffect(() => {
    let live = true;
    const beat = () =>
      heartbeat(post.id)
        .then((r) => live && setHere(r))
        .catch(() => undefined);
    void beat();
    const t = setInterval(beat, 20_000);
    return () => {
      live = false;
      clearInterval(t);
      void leave(post.id).catch(() => undefined);
    };
  }, [post.id]);

  /* ---------------- keyboard ---------------- */
  const shortcuts = useRef<HTMLDialogElement>(null);
  const keys = useRef({ undo, redo, save, idx, n: draft.slides.length, goSlide, editing, say });
  useEffect(() => {
    keys.current = { undo, redo, save, idx, n: draft.slides.length, goSlide, editing, say };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) k.redo();
        else k.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        k.redo();
      } else if (mod && key === "s") {
        e.preventDefault();
        void k.save.flush().then((ok) => k.say(ok ? "Saved." : "Not saved yet. See the message at the top."));
      } else if (!mod && !e.altKey && !isTyping(e.target) && !k.editing && !document.querySelector("dialog[open]")) {
        if (e.key === "?") {
          e.preventDefault();
          shortcuts.current?.showModal();
        } else if (e.key === "ArrowLeft" && k.idx > 0) {
          e.preventDefault();
          k.goSlide(k.idx - 1);
          k.say(`Slide ${k.idx} of ${k.n}.`);
        } else if (e.key === "ArrowRight" && k.idx < k.n - 1) {
          e.preventDefault();
          k.goSlide(k.idx + 1);
          k.say(`Slide ${k.idx + 2} of ${k.n}.`);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- canvas size ---------------- */
  const [maxH, setMaxH] = useState(640);
  useEffect(() => {
    const fit = () => setMaxH(Math.max(340, Math.min(window.innerHeight - 200, 760)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function onTabKey(e: ReactKeyboardEvent<HTMLButtonElement>, i: number) {
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    const j = (next + PANES.length) % PANES.length;
    document.getElementById(`tab-${PANES[j]![0]}`)?.focus();
  }

  const title = draft.slides[0]?.fields.headline.trim().split("\n")[0] || draft.slides[0]?.fields.series || "Untitled post";
  const when = fromLocalInput(draft.scheduled);
  const [note, setNote] = useState("");

  return (
    <div className={styles.editor}>
      <div className="visually-hidden" role="status" aria-live="polite">
        {said}
      </div>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <p className={styles.crumbs}>
            <Link href="/posts">All posts</Link>
            {post.eventId && post.eventTitle ? (
              <>
                <span aria-hidden="true"> / </span>
                <Link href={`/events/${post.eventId}` as Route}>{post.eventTitle}</Link>
              </>
            ) : null}
          </p>
          <h1>{title}</h1>
          <div className={styles.headMeta}>
            <StatusWord status={post.status} />
            <span>{KIND_LABEL[draft.kind] ?? "Post"}</span>
            <span suppressHydrationWarning>{when ? `${fmtDateTime(when)}, ${relativeDay(when)}` : "Not scheduled"}</span>
            <SaveWord state={save.state} onRetry={() => void save.flush()} />
            {here.length ? (
              <span className={styles.presence}>
                <Spark /> {here.map((h) => h.name).join(" and ")} {here.length === 1 ? "is" : "are"} also editing
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.headTools}>
          <ExportBar slides={draft.slides} sel={idx} format={shown} formats={draft.formats} captions={draft.captions} errorCount={errorCount} />
          <button type="button" className="btn btn-s btn-quiet" onClick={() => shortcuts.current?.showModal()} aria-keyshortcuts="?">
            Shortcuts
          </button>
        </div>
      </header>

      {save.state.kind === "conflict" ? (
        <div className={`notice notice-danger ${styles.banner}`} role="alert">
          <span>
            <b>Someone else saved this post while you were editing.</b> Your latest changes aren’t saved. Copy anything you want to keep, then load their version.
          </span>
          <button
            type="button"
            className="btn btn-s"
            onClick={() => {
              save.allowLeave();
              window.location.reload();
            }}
          >
            Load their version
          </button>
        </div>
      ) : null}
      {readOnly ? <p className={`notice ${styles.banner}`}>This post is published, so it’s locked. Reopen it from Review to change it.</p> : null}

      <div className={`${styles.desk} ${pane ? styles.withPane : ""} ${inspectorOpen ? styles.withInspector : ""}`}>
        <div className={styles.rail} role="tablist" aria-label="Post" aria-orientation="vertical">
          {PANES.map(([key, label], i) => {
            const count = key === "checks" ? issues.length : 0;
            return (
              <button
                key={key}
                id={`tab-${key}`}
                type="button"
                role="tab"
                aria-selected={pane === key}
                aria-controls={pane === key ? `pane-${key}` : undefined}
                tabIndex={pane ? (pane === key ? 0 : -1) : i === 0 ? 0 : -1}
                className={styles.tab}
                onClick={() => setPane(pane === key ? null : key)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {label}
                {key === "checks" && count ? (
                  <span className={`figures ${errorCount ? styles.errText : styles.muted}`}>{errorCount ? `${errorCount} to fix` : `${count} to check`}</span>
                ) : null}
                {key === "review" ? <span className={styles.muted}>{post.status === "in_review" && post.authorId !== me.id ? <Spark label="Waiting for review" /> : null}</span> : null}
              </button>
            );
          })}
        </div>

        {pane ? (
          <div className={styles.pane} role="tabpanel" id={`pane-${pane}`} aria-labelledby={`tab-${pane}`}>
            {pane === "captions" ? (
              <CaptionsPanel captions={draft.captions} onChange={(c) => update((d) => ({ ...d, captions: c }), "captions")} issuesFor={issuesFor} postId={post.id} flush={save.flush} readOnly={readOnly} />
            ) : pane === "checks" ? (
              <ChecksPanel issues={issues} onGo={goTo} />
            ) : pane === "schedule" ? (
              <SettingsPanel draft={draft} slides={draft.slides} onChange={(patch) => update((d) => ({ ...d, ...patch }), Object.keys(patch).join())} readOnly={readOnly} />
            ) : (
              <ReviewPanel
                post={post}
                me={me}
                names={names}
                approvers={approvers}
                activity={activity}
                channels={draft.channels}
                errorCount={errorCount}
                lastEditorIsMe={savedHere || post.updatedBy === me.id}
                getVersion={save.getVersion}
                setVersion={save.setVersion}
                flush={save.flush}
                onConflict={save.block}
              />
            )}
          </div>
        ) : null}

        <div className={styles.workspace} role="region" aria-label="Canvas">
          <div className={styles.toolbar}>
            <fieldset className={styles.formatSeg}>
              <legend className="visually-hidden">Format</legend>
              <div className="seg">
                {allowed.map((f) => (
                  <label key={f}>
                    <input
                      type="radio"
                      name="canvas-format"
                      value={f}
                      checked={!allFormats && shown === f}
                      onChange={() => {
                        setFmt(f);
                        setAllFormats(false);
                      }}
                    />
                    {FORMAT_LABEL[f]}
                    {draft.formats.includes(f) ? null : <span className="visually-hidden"> (not exported)</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="button" className="btn btn-s" aria-pressed={allFormats} onClick={() => setAllFormats(!allFormats)} disabled={allowed.length < 2}>
              Side by side
            </button>
            <span className={`figures ${styles.muted}`}>
              Slide {idx + 1} of {draft.slides.length}
            </span>
            <button type="button" className={`btn btn-s btn-quiet ${styles.push}`} aria-expanded={inspectorOpen} aria-controls="inspector" onClick={() => setInspectorOpen(!inspectorOpen)}>
              {inspectorOpen ? "Hide inspector" : "Show inspector"}
            </button>
          </div>

          <div className={styles.canvasArea}>
          {allFormats ? (
            <div className={styles.sideBySide}>
              {allowed.map((f) => {
                const [w, h] = SIZES[f];
                const scale = Math.min(maxH / h, 1) * (allowed.length > 2 ? 0.55 : 0.7);
                return (
                  <button
                    key={f}
                    type="button"
                    className={styles.sideItem}
                    onClick={() => {
                      setFmt(f);
                      setAllFormats(false);
                    }}
                    aria-label={`Edit in ${FORMAT_LABEL[f]}`}
                  >
                    <span className={styles.sideCanvas} style={{ width: Math.round(w * scale) }}>
                      <PostCanvas slide={slide} format={f} scale={scale} />
                    </span>
                    <span className={styles.sideLabel}>
                      {FORMAT_LABEL[f]}
                      {draft.formats.includes(f) ? "" : ", not exported"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <CanvasEditor
              slide={slide}
              slideIndex={idx}
              format={shown}
              selection={selection}
              editing={editing}
              onSelect={(s) => {
                setSelection(s);
                setInspectorOpen(true);
              }}
              onEdit={(key, opts) => (key ? openText(idx, key) : closeText(opts))}
              onText={(key, value) => fieldsAt(idx, (f) => setText(f, key, value), key)}
              onImage={(slot, img) => imageAt(idx, slot, img)}
              onCrop={openCrop}
              issues={issues}
              issueNumber={issueNumber}
              uploadMode={uploadMode}
              readOnly={readOnly}
              maxHeight={maxH}
              onMessage={(t) => {
                setNote(t);
                say(t);
              }}
            />
          )}
          </div>
          <p className={styles.note}>
            {note || (readOnly ? "Published posts are locked." : "Click words on the graphic to type over them. Drag photos to frame them; scroll to zoom; drop a file on a frame. Press ? for shortcuts.")}
          </p>

          <SlideStrip slides={draft.slides} sel={idx} format={shown} onSelect={goSlide} onAdd={addSlide} onDuplicate={duplicateSlide} onDelete={deleteSlide} onReorder={reorder} readOnly={readOnly} />
        </div>

        {inspectorOpen ? (
          <aside className={styles.inspector} id="inspector" aria-labelledby="inspector-h">
            <Inspector
              key={`${slide.id}-${selection.kind}`}
              slide={slide}
              index={idx}
              selection={selection}
              onSelect={setSelection}
              onFields={(fn, key) => fieldsAt(idx, fn, key)}
              onTemplate={changeTemplate}
              onFamily={changeFamily}
              onEditText={(k) => openText(idx, k)}
              issuesFor={issuesFor}
              speakers={speakers}
              partners={partners}
              uploadMode={uploadMode}
              frames={frames}
              formatName={FORMAT_LABEL[shown].toLowerCase()}
              onCrop={(s) => openCrop(s)}
              readOnly={readOnly}
            />
          </aside>
        ) : null}
      </div>

      <LayoutProbe slides={probeSlides} formats={probeFormats} onResult={setProbe} />
      <CropDialog target={crop} img={cropImg} onChange={(img) => crop && imageAt(crop.slide, crop.key, img)} onClose={() => setCrop(null)} />
      <dialog ref={shortcuts} className="dlg" aria-labelledby="keys-h">
        <h2 id="keys-h">Keyboard shortcuts</h2>
        <table className={`table ${styles.keys}`}>
          <tbody>
            {SHORTCUTS.map(([k, what]) => (
              <tr key={k}>
                <th scope="row">
                  <kbd>{k}</kbd>
                </th>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={`btn-row ${styles.dlgActions}`}>
          <button type="button" className="btn btn-primary" onClick={() => shortcuts.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}

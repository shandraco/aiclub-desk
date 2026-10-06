"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchDesk, type Hit } from "@/app/(desk)/search/actions";
import { icons } from "./icons";
import styles from "./CommandBar.module.css";

interface Item {
  id: string;
  group: string;
  title: string;
  detail?: string;
  href: string;
}

const COMMANDS: Item[] = [
  { id: "c-event", group: "Create", title: "New event", detail: "Its posts get planned for you", href: "/events/new" },
  { id: "c-post", group: "Create", title: "New post from a template", detail: "News, photos, speakers, recaps", href: "/templates" },
  { id: "g-week", group: "Go to", title: "This week", href: "/" },
  { id: "g-cal", group: "Go to", title: "Calendar", href: "/calendar" },
  { id: "g-events", group: "Go to", title: "Events", href: "/events" },
  { id: "g-posts", group: "Go to", title: "Posts", href: "/posts" },
  { id: "g-review", group: "Go to", title: "Posts waiting for review", href: "/posts?status=in_review" },
  { id: "g-lib", group: "Go to", title: "Library", detail: "Speakers, partners, rooms", href: "/library" },
  { id: "g-results", group: "Go to", title: "Results", href: "/results" },
  { id: "g-templates", group: "Go to", title: "Templates", detail: "Every design, by family and use", href: "/templates" },
  { id: "g-account", group: "Go to", title: "Your account", href: "/account" },
];

const GROUP: Record<Hit["kind"], string> = { event: "Events", post: "Posts", speaker: "Speakers", partner: "Partners" };

/**
 * ⌘K / Ctrl+K (or "/") anywhere: jump to any page, start something, or find an event, post,
 * speaker or partner by name. ARIA combobox with a listbox; arrows, Enter and Escape work.
 */
export function CommandBar() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform is only known in the browser
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results
      setHits([]);
      return;
    }
    // Each keystroke supersedes the last; only the newest answer is shown.
    const id = ++seq.current;
    const t = setTimeout(() => {
      setPending(true);
      searchDesk(term)
        .then((found) => {
          if (id === seq.current) setHits(found);
        })
        .catch(() => {
          if (id === seq.current) setHits([]);
        })
        .finally(() => {
          if (id === seq.current) setPending(false);
        });
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cmds = term ? COMMANDS.filter((c) => `${c.title} ${c.detail ?? ""}`.toLowerCase().includes(term)) : COMMANDS;
    return [...hits.map((h) => ({ id: `${h.kind}-${h.id}`, group: GROUP[h.kind], title: h.title, detail: h.detail, href: h.href })), ...cmds];
  }, [q, hits]);

  function open() {
    setQ("");
    setActive(0);
    dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.focus());
  }
  function go(item: Item | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href as Route);
  }

  let lastGroup = "";
  return (
    <>
      <button type="button" className={styles.trigger} onClick={open} aria-keyshortcuts="Meta+K Control+K">
        <span className={styles.triggerIcon}>{icons.search}</span>
        <span className={styles.triggerLabel}>{mac ? "⌘K" : "Ctrl K"}</span>
        <span className="visually-hidden">Search and commands</span>
      </button>
      {/* Clicking the backdrop closes it; keyboard users have Escape, which <dialog> handles natively. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog ref={dialog} className={styles.dlg} aria-label="Search and commands" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className={styles.box}>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>{icons.search}</span>
            <input
              ref={input}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={items[active] ? `${listId}-${items[active]!.id}` : undefined}
              aria-autocomplete="list"
              className={styles.input}
              placeholder="Find an event, post or speaker, or type a command"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(items[active]);
                }
              }}
            />
            <kbd>esc</kbd>
          </div>
          <div id={listId} role="listbox" className={styles.list} aria-label="Results">
            {items.map((item, i) => {
              const head = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.id} role="presentation">
                  {head ? <p className={styles.group} aria-hidden="true">{head}</p> : null}
                  {/* Combobox pattern: focus stays in the input (aria-activedescendant); arrows and Enter are handled there. */}
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                  <div
                    id={`${listId}-${item.id}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === active}
                    className={styles.option}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(item)}
                  >
                    <span className={styles.title}>{item.title}</span>
                    {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
                  </div>
                </div>
              );
            })}
            {!items.length && !pending ? <div className={styles.none}>Nothing matches “{q}”.</div> : null}
          </div>
          <p className={styles.foot} aria-live="polite">{pending ? "Searching…" : `${items.length} results · ↑↓ to move · Enter to open`}</p>
        </div>
      </dialog>
    </>
  );
}

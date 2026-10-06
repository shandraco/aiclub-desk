"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { addComment, approvePost, askForChanges, askForReview, deletePostAction, duplicatePost, markAsPosted, reopenPost, type Result } from "@/app/(desk)/posts/[id]/actions";
import { Spark } from "@/components/Spark";
import { StatusWord } from "@/components/StatusWord";
import { can } from "@/lib/auth/rules";
import { ago, fmtDateTime } from "@/lib/time";
import type { ActivityItem, Channel, EditorPost, Me, Person } from "./types";
import styles from "./editor.module.css";

const VERB: Record<ActivityItem["action"], string> = {
  created: "started the post",
  comment: "commented",
  review_requested: "asked for review",
  changes_requested: "asked for changes",
  approved: "approved it",
  reopened: "reopened it",
  posted: "marked it posted",
  results: "logged results",
};

const CHANNEL_LABEL: Record<Channel, string> = { instagram: "Instagram post", story: "Instagram story", linkedin: "LinkedIn post" };

/**
 * Status, who is involved, what this person can do next, and the activity log. Every button
 * calls a server action that goes through lib/posts/workflow.ts; the action refreshes the page.
 */
export function ReviewPanel({
  post,
  me,
  names,
  approvers,
  activity,
  channels,
  errorCount,
  lastEditorIsMe,
  getVersion,
  setVersion,
  flush,
  onConflict,
}: {
  post: EditorPost;
  me: Me;
  names: Record<string, string>;
  approvers: Person[];
  activity: ActivityItem[];
  channels: Channel[];
  errorCount: number;
  lastEditorIsMe: boolean;
  getVersion: () => number;
  setVersion: (v: number) => void;
  flush: () => Promise<boolean>;
  onConflict: (message: string) => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; danger?: boolean } | null>(null);
  const [reviewer, setReviewer] = useState<string>(post.reviewerId && post.reviewerId !== me.id ? post.reviewerId : "");
  const [askNote, setAskNote] = useState("");
  const [checks, setChecks] = useState({ facts: false, tagged: false, consent: false });
  const [reviewNote, setReviewNote] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [commentText, setCommentText] = useState("");
  const del = useRef<HTMLDialogElement>(null);

  const name = (id: string | null) => (id ? (id === me.id ? "you" : (names[id] ?? "someone")) : null);
  const s = post.status;
  const isAuthor = post.authorId === me.id;
  const canApprove = can(me.role, "post.approve");
  const hasSpeakers = post.slides.some((x) => x.template === "speaker");
  const others = approvers.filter((a) => a.id !== me.id && a.id !== post.authorId);
  const canDelete = (can(me.role, "post.delete") || isAuthor) && s !== "posted";

  const approveBlock = !canApprove
    ? "Only officers and admins approve posts."
    : isAuthor
      ? "You wrote this post, so someone else approves it."
      : lastEditorIsMe
        ? "You made the last edit, so someone else approves it."
        : errorCount
          ? `Fix the ${errorCount === 1 ? "brand check error" : `${errorCount} brand check errors`} first.`
          : null;
  const boxesDone = checks.facts && checks.tagged && (!hasSpeakers || checks.consent);

  /** Saves pending edits, then runs a workflow action with the version that save produced. */
  function act(run: (version: number) => Promise<Result>, done?: string, after?: () => void) {
    setMsg(null);
    start(async () => {
      const saved = await flush();
      if (!saved) {
        setMsg({ text: "Your latest edits haven’t saved yet. Fix the save problem first, then try again.", danger: true });
        return;
      }
      const res = await run(getVersion());
      if (res.ok) {
        if (res.version) setVersion(res.version);
        if (done) setMsg({ text: done });
        after?.();
      } else if (res.conflict) {
        onConflict(res.message);
      } else {
        setMsg({ text: res.message, danger: true });
      }
    });
  }

  const latestChanges = [...activity].reverse().find((a) => a.action === "changes_requested");

  let next: ReactNode = null;
  if (s === "draft" || s === "changes_requested") {
    next = (
      <form
        className={styles.reviewForm}
        onSubmit={(e) => {
          e.preventDefault();
          act((v) => askForReview({ postId: post.id, version: v, reviewerId: reviewer || null, message: askNote }), "Sent for review.", () => setAskNote(""));
        }}
      >
        {s === "changes_requested" && latestChanges ? (
          <p className="notice notice-danger">
            <span>
              <b>{latestChanges.actorName} asked for changes:</b> {latestChanges.body}
            </span>
          </p>
        ) : null}
        <div className={styles.field}>
          <label htmlFor="rv-who">Who reviews it</label>
          <select id="rv-who" className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
            <option value="">Anyone who can approve</option>
            {others.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="rv-note">Note for them (optional)</label>
          <textarea id="rv-note" className="input" rows={2} maxLength={2000} value={askNote} onChange={(e) => setAskNote(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {s === "changes_requested" ? "Ask for review again" : "Ask for review"}
        </button>
      </form>
    );
  } else if (s === "in_review") {
    next = (
      <div className={styles.reviewForm}>
        <p>
          {post.reviewerId === me.id ? (
            <>
              <Spark /> You’re asked to review this.
            </>
          ) : post.reviewerId ? (
            <>Waiting for {name(post.reviewerId)} to review it.</>
          ) : (
            <>Waiting for any officer or admin to review it.</>
          )}
        </p>
        <fieldset className={styles.group}>
          <legend>Before approving</legend>
          <label className="check">
            <input type="checkbox" checked={checks.facts} onChange={(e) => setChecks({ ...checks, facts: e.target.checked })} disabled={!canApprove || isAuthor} />
            <span>Date, time, room and names are right</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={checks.tagged} onChange={(e) => setChecks({ ...checks, tagged: e.target.checked })} disabled={!canApprove || isAuthor} />
            <span>Partners and speakers will be tagged correctly</span>
          </label>
          {hasSpeakers ? (
            <label className="check">
              <input type="checkbox" checked={checks.consent} onChange={(e) => setChecks({ ...checks, consent: e.target.checked })} disabled={!canApprove || isAuthor} />
              <span>Every speaker agreed to their photo and title</span>
            </label>
          ) : null}
        </fieldset>
        <div className={styles.field}>
          <label htmlFor="rv-msg">Message to the author</label>
          <textarea id="rv-msg" className="input" rows={2} maxLength={2000} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} disabled={!canApprove || isAuthor} aria-describedby="rv-msg-hint" />
          <span id="rv-msg-hint" className={styles.hint}>Optional to approve. Needed to ask for changes.</span>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !!approveBlock || !boxesDone}
            aria-describedby={approveBlock ? "rv-block" : undefined}
            onClick={() => act((v) => approvePost({ postId: post.id, version: v, checklist: checks, message: reviewNote }), "Approved.")}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending || !canApprove || isAuthor}
            onClick={() => {
              if (!reviewNote.trim()) {
                setMsg({ text: "Say what needs to change, so the author knows what to fix.", danger: true });
                document.getElementById("rv-msg")?.focus();
                return;
              }
              act((v) => askForChanges({ postId: post.id, version: v, message: reviewNote }), "Sent back with your notes.", () => setReviewNote(""));
            }}
          >
            Ask for changes
          </button>
          {isAuthor ? (
            <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => act((v) => reopenPost({ postId: post.id, version: v, reason: "Withdrawn from review." }), "Back to draft.")}>
              Withdraw
            </button>
          ) : null}
        </div>
        {approveBlock ? (
          <p id="rv-block" className={styles.hint}>
            {approveBlock}
          </p>
        ) : !boxesDone ? (
          <p className={styles.hint}>Tick every box to approve.</p>
        ) : null}
      </div>
    );
  } else if (s === "approved") {
    next = (
      <form
        className={styles.reviewForm}
        onSubmit={(e) => {
          e.preventDefault();
          act((v) => markAsPosted({ postId: post.id, version: v, urls }), "Marked as posted.");
        }}
      >
        <p>
          Approved by {name(post.approvedBy) ?? "someone"}
          {post.approvedAt ? <span suppressHydrationWarning>, {ago(post.approvedAt)}</span> : null}. Export it and post it, then mark it here.
        </p>
        {can(me.role, "post.markPosted") ? (
          <>
            {(channels.length ? channels : (["instagram"] as Channel[])).map((c) => (
              <div className={styles.field} key={c}>
                <label htmlFor={`url-${c}`}>Link to the {CHANNEL_LABEL[c]} (optional)</label>
                <input id={`url-${c}`} type="url" className="input" inputMode="url" placeholder="https://" value={urls[c] ?? ""} onChange={(e) => setUrls({ ...urls, [c]: e.target.value })} />
              </div>
            ))}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                Mark as posted
              </button>
              <button type="button" className="btn" disabled={pending} onClick={() => act((v) => reopenPost({ postId: post.id, version: v, reason: "" }), "Back to draft.")}>
                Reopen
              </button>
            </div>
          </>
        ) : (
          <p className={styles.hint}>An officer or admin marks it as posted.</p>
        )}
      </form>
    );
  } else if (s === "posted") {
    const links = Object.entries(post.postedUrls);
    next = (
      <div className={styles.reviewForm}>
        <p suppressHydrationWarning>{`Posted${post.postedAt ? ` ${fmtDateTime(post.postedAt)}` : ""}. Published posts are locked.`}</p>
        {links.length ? (
          <ul className={styles.links}>
            {links.map(([c, u]) => (
              <li key={c}>
                <a href={u} target="_blank" rel="noopener noreferrer">
                  {CHANNEL_LABEL[c as Channel] ?? c}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {can(me.role, "post.markPosted") ? (
          <button type="button" className="btn" disabled={pending} onClick={() => act((v) => reopenPost({ postId: post.id, version: v, reason: "Reopened after posting." }), "Reopened as a draft.")}>
            Reopen
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="panel" id="review" aria-labelledby="review-h">
      <h2 id="review-h">
        Review
        <small>
          <StatusWord status={s} />
        </small>
      </h2>
      <dl className={styles.people}>
        <div>
          <dt>Written by</dt>
          <dd>{name(post.authorId) ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Reviewer</dt>
          <dd>{name(post.reviewerId) ?? (s === "in_review" ? "Any officer" : "Not asked yet")}</dd>
        </div>
        <div>
          <dt>Approved by</dt>
          <dd>{name(post.approvedBy) ?? "Not yet"}</dd>
        </div>
      </dl>
      {next}
      <div role="status" aria-live="polite">
        {msg ? <p className={`notice ${msg.danger ? "notice-danger" : ""} ${styles.gapTop}`}>{msg.text}</p> : null}
      </div>

      <div className={`btn-row ${styles.postTools}`}>
        <button type="button" className="btn btn-s" disabled={pending} onClick={() => start(async () => {
          const ok = await flush();
          if (!ok) return setMsg({ text: "Save your edits first; the copy would miss them.", danger: true });
          const r = await duplicatePost(post.id);
          if (r && !r.ok) setMsg({ text: r.message, danger: true });
        })}>
          Duplicate post
        </button>
        {canDelete ? (
          <button type="button" className="btn btn-s btn-danger" onClick={() => del.current?.showModal()}>
            Delete post
          </button>
        ) : null}
      </div>
      <dialog ref={del} className="dlg" aria-labelledby="del-h">
        <h2 id="del-h">Delete this post?</h2>
        <p className={styles.gapTop}>Its slides, captions and activity go for good. This can’t be undone.</p>
        <div className={`btn-row ${styles.dlgActions}`}>
          <button type="button" className="btn" onClick={() => del.current?.close()}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deletePostAction(post.id);
                if (r && !r.ok) {
                  del.current?.close();
                  setMsg({ text: r.message, danger: true });
                }
              })
            }
          >
            Delete post
          </button>
        </div>
      </dialog>

      <h3 className={styles.subhead}>Activity</h3>
      <ol className={`ruled ${styles.timeline}`}>
        {activity.map((a) => (
          <li key={a.id}>
            <p>
              <b>{a.actorName}</b> {VERB[a.action]}
              <time dateTime={a.createdAt.toISOString()} className={styles.when} suppressHydrationWarning>
                {ago(a.createdAt)}
              </time>
            </p>
            {a.body ? <p className={styles.body}>{a.body}</p> : null}
          </li>
        ))}
      </ol>
      <form
        className={styles.commentForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (!commentText.trim()) return;
          start(async () => {
            const r = await addComment({ postId: post.id, body: commentText });
            if (r.ok) setCommentText("");
            else setMsg({ text: r.message, danger: true });
          });
        }}
      >
        <label htmlFor="comment">Comment</label>
        <textarea id="comment" className="input" rows={2} maxLength={2000} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="A question or a note for whoever picks this up" />
        <button type="submit" className="btn btn-s" disabled={pending || !commentText.trim()}>
          Add comment
        </button>
      </form>
    </section>
  );
}

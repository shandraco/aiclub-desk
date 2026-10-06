import type { Route } from "next";
import Link from "next/link";
import { PostThumb } from "@/components/post/PostThumb";
import { Spark } from "@/components/Spark";
import { StatusWord } from "@/components/StatusWord";
import { KIND_LABEL } from "@/lib/brand/presets";
import type { PostLite } from "@/lib/planning/queries";
import type { Format } from "@/lib/posts/types";
import { fmtDate, fmtTime } from "@/lib/time";
import ui from "./ui.module.css";

/** Thumbnail width per size and format, so feed, story and wide covers sit at similar visual weight. */
export const THUMB: Record<"s" | "m" | "l" | "xl", Record<Format, number>> = {
  s: { feed: 64, story: 48, wide: 96 },
  m: { feed: 96, story: 72, wide: 128 },
  l: { feed: 140, story: 104, wide: 148 },
  xl: { feed: 160, story: 118, wide: 176 },
};

/**
 * One post as the desk shows it everywhere: its real cover, what it is, when, and its status.
 * The whole chip is one link to the post.
 */
export function PostChip({
  post,
  layout = "stack",
  size = "m",
  showDate = false,
  showEvent = false,
  flag,
}: {
  post: PostLite;
  layout?: "stack" | "row";
  size?: keyof typeof THUMB;
  showDate?: boolean;
  showEvent?: boolean;
  /** An attention note, shown with the gold spark: "Overdue", "Event cancelled". */
  flag?: string;
}) {
  const kind = KIND_LABEL[post.kind] ?? "Post";
  const when = post.scheduledFor ? (showDate ? `${fmtDate(post.scheduledFor)} · ${fmtTime(post.scheduledFor, true)}` : fmtTime(post.scheduledFor, true)) : "Not scheduled";
  return (
    <Link href={`/posts/${post.id}` as Route} className={`${ui.chip} ${layout === "row" ? ui.chipRow : ""}`}>
      {post.cover ? (
        <span className={ui.chipThumb}>
          <PostThumb slide={post.cover} format={post.format} width={THUMB[size][post.format]} />
          {post.slideCount > 1 ? <span className={ui.stackMark} aria-hidden="true" /> : null}
        </span>
      ) : null}
      <span className={ui.chipText}>
        <span className={ui.chipKind}>
          {kind}
          {post.slideCount > 1 ? <span className="muted"> · {post.slideCount} slides</span> : null}
        </span>
        {showEvent && post.eventTitle ? <span className={ui.chipEvent}>{post.eventTitle}</span> : null}
        <span className={`figures muted ${ui.chipWhen}`}>{when}</span>
        <StatusWord status={post.status} />
        {flag ? (
          <span className={ui.flag}>
            <Spark /> {flag}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

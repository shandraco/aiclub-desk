const LABEL = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes asked",
  approved: "Approved",
  posted: "Posted",
} as const;

export type PostStatus = keyof typeof LABEL;
export const STATUS_LABEL = LABEL;

/** Status as a word in its state colour with a small mark. Never a pill. */
export function StatusWord({ status }: { status: PostStatus }) {
  return <span className={`status status-${status}`}>{LABEL[status]}</span>;
}

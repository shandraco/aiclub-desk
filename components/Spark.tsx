/** The club's 4-point spark. Gold means: this needs someone's attention. */
export function Spark({ label }: { label?: string }) {
  return (
    <svg className="spark" viewBox="0 0 144 144" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <path d="M72 0C72 32 112 72 144 72C112 72 72 112 72 144C72 112 32 72 0 72C32 72 72 32 72 0Z" />
    </svg>
  );
}

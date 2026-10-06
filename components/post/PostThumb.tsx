import { PostCanvas } from "./PostCanvas";
import { SIZES, type Format, type Slide } from "@/lib/posts/types";

/**
 * A post's cover drawn small, at a target width in CSS pixels. Used in lists, the calendar
 * and the week view, so the desk shows the actual graphics, not icons standing in for them.
 */
export function PostThumb({ slide, format = "feed", width = 120 }: { slide: Slide; format?: Format; width?: number }) {
  const scale = width / SIZES[format][0];
  return (
    <div className="post-thumb" aria-hidden="true">
      <PostCanvas slide={slide} format={format} scale={scale} />
    </div>
  );
}

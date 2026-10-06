import { parseDayKey, weekdayOfKey } from "@/lib/time";
import ui from "./ui.module.css";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const weekdayName = (key: string, long = false) => (long ? WEEKDAY : WD)[weekdayOfKey(key)]!;
export const monthName = (key: string, long = false) => (long ? MONTH_LONG : MONTH)[parseDayKey(key).month - 1]!;
/** "Tuesday, October 14" from a day key. */
export const dayLabel = (key: string) => `${weekdayName(key, true)}, ${monthName(key, true)} ${parseDayKey(key).day}`;

/** The big day numeral with its weekday and month: the desk's way of writing a date. */
export function DateBlock({ day, size = "l", sub, emphasis = false, as: Tag = "div" }: { day: string; size?: "m" | "l"; sub?: string; emphasis?: boolean; as?: "div" | "span" }) {
  const { day: d } = parseDayKey(day);
  return (
    <Tag className={`${ui.date} ${size === "m" ? ui.dateM : ""} ${emphasis ? ui.dateEm : ""}`}>
      <span className={ui.dateNum} aria-hidden="true">{d}</span>
      <span className={ui.dateWords} aria-hidden="true">
        <span>{weekdayName(day)}</span>
        <span className="muted">{sub ?? monthName(day)}</span>
      </span>
      <span className="visually-hidden">{dayLabel(day)}{sub ? `, ${sub}` : ""}</span>
    </Tag>
  );
}

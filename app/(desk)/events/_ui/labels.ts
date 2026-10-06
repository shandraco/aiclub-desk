export { KIND_LABEL } from "@/lib/brand/presets";

/** A plan step's name mid-sentence: "No reminder yet", "Add LinkedIn post". */
const STEP_WORDS: Record<string, string> = { announce: "announcement", linkedin: "LinkedIn post", reminder: "reminder", day_of: "day-of story", recap: "recap" };
export const stepLabel = (kind: string) => STEP_WORDS[kind] ?? "post";

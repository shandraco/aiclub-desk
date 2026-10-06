/** The numbers officers copy from Instagram and LinkedIn insights, in table order. */
export const METRICS = [
  { key: "reach", label: "Reach", hint: "Accounts reached" },
  { key: "likes", label: "Likes", hint: "Likes or reactions" },
  { key: "comments", label: "Comments", hint: "" },
  { key: "shares", label: "Shares", hint: "Shares or reposts" },
  { key: "saves", label: "Saves", hint: "Instagram only" },
  { key: "clicks", label: "Clicks", hint: "Link or profile clicks" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];

export const CHANNEL_LABEL: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", story: "Story" };
export const channelLabel = (c: string) => CHANNEL_LABEL[c] ?? c;

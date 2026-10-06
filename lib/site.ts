import "server-only";
import { env } from "@/lib/env";

export const site = {
  name: "Content Desk",
  org: "AI Club, Wichita State University",
  description: "Plan events, make on-brand posts, review them together and log how they did.",
  url: env.SITE_URL,
  /** Every date and time in the desk is shown in Wichita time. */
  timeZone: "America/Chicago",
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${site.url}/`).toString();
}

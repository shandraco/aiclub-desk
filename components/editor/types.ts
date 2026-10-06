import type { Captions, Format, ImageRef, LogoTone, Slide } from "@/lib/posts/types";
import type { PostStatus } from "@/components/StatusWord";
import type { Role } from "@/lib/auth/rules";

/** What the editor page hands its client components. Dates arrive as Date (RSC props). */

export type Kind = "announce" | "linkedin" | "reminder" | "day_of" | "recap" | "photos" | "custom";
export type Channel = "instagram" | "linkedin" | "story";

export interface EditorPost {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  kind: Kind;
  preset: string;
  slides: Slide[];
  captions: Captions;
  formats: Format[];
  channels: Channel[];
  status: PostStatus;
  scheduledFor: Date | null;
  authorId: string | null;
  reviewerId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  updatedBy: string | null;
  postedAt: Date | null;
  postedUrls: Record<string, string>;
  checklist: { facts: boolean; tagged: boolean; consent: boolean };
  version: number;
  updatedAt: Date;
}

export interface Me {
  id: string;
  displayName: string;
  role: Role;
}

export interface LibSpeaker {
  id: string;
  name: string;
  role: string;
  photo: ImageRef | null;
}

export interface LibPartner {
  id: string;
  name: string;
  logo: string | null;
  tone: LogoTone;
}

export interface Person {
  id: string;
  displayName: string;
}

export interface ActivityItem {
  id: string;
  actorName: string;
  action: "created" | "comment" | "review_requested" | "changes_requested" | "approved" | "reopened" | "posted" | "results";
  body: string;
  createdAt: Date;
}

/** The editable part of a post: the editor's local source of truth while someone types. */
export interface Draft {
  slides: Slide[];
  captions: Captions;
  formats: Format[];
  channels: Channel[];
  /** datetime-local value in Wichita time, "" for unscheduled. */
  scheduled: string;
  kind: Kind;
}

export type UploadMode = "blob" | "dev" | "off";

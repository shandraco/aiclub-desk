import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { EventForm } from "../_ui/EventForm";
import { formChoices } from "../_ui/formData";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!can(user.role, "event.edit")) {
    return (
      <>
        <header className="page-head"><h1>New event</h1></header>
        <p className="empty"><strong>Officers add events.</strong>Ask an officer or admin to add it; you can then write its posts. <Link href={"/events" as Route}>Back to events</Link></p>
      </>
    );
  }
  const choices = await formChoices();
  return (
    <>
      <header className="page-head">
        <div>
          <h1>New event</h1>
          <p>Type the facts once. The desk makes its posts, dated from the start time, for a second officer to review.</p>
        </div>
      </header>
      <EventForm
        initial={{ title: "", preset: "workshop", seriesLabel: "", summary: "", startsAt: "", endsAt: "", roomId: "", place: "", rsvpUrl: "", speakers: [], partners: [] }}
        {...choices}
        now={new Date().toISOString()}
      />
    </>
  );
}

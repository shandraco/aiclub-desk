import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { eventLinks, getEvent } from "@/lib/planning/queries";
import { toLocalInput } from "@/lib/time";
import { EventForm } from "../../_ui/EventForm";
import { formChoices } from "../../_ui/formData";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/login");
  const ev = await getEvent(id);
  if (!ev) notFound();
  if (!can(user.role, "event.edit")) {
    return (
      <>
        <header className="page-head"><h1>{ev.title}</h1></header>
        <p className="empty"><strong>Officers edit events.</strong>Ask an officer or admin to change it. <Link href={`/events/${ev.id}` as Route}>Back to the event</Link></p>
      </>
    );
  }
  const [choices, links] = await Promise.all([formChoices(ev.id), eventLinks(ev.id)]);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Edit {ev.title}</h1>
          <p>Changes show on posts made from now on. Posts already made keep their words until you edit them.</p>
        </div>
      </header>
      <EventForm
        initial={{
          id: ev.id,
          title: ev.title,
          preset: ev.preset,
          seriesLabel: ev.seriesLabel,
          summary: ev.summary,
          startsAt: toLocalInput(ev.startsAt),
          endsAt: toLocalInput(ev.endsAt),
          roomId: links.roomId ?? "",
          place: ev.place,
          rsvpUrl: ev.rsvpUrl,
          speakers: links.speakerIds,
          partners: links.partnerIds,
        }}
        {...choices}
        now={new Date().toISOString()}
      />
    </>
  );
}

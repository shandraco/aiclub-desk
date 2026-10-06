import { eq } from "drizzle-orm";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { presetByKey } from "@/lib/brand/presets";
import { db, schema } from "@/lib/db";
import { TEMPLATES, type TemplateKey } from "@/lib/posts/types";
import { fmtDate } from "@/lib/time";
import { StartButton, StartForm } from "./StartForm";
import styles from "./new.module.css";

export const metadata: Metadata = { title: "New post" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { event } = await searchParams;

  if (event && UUID.test(event)) {
    const [ev] = await db()
      .select({ id: schema.events.id, title: schema.events.title, preset: schema.events.preset, startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(eq(schema.events.id, event))
      .limit(1);
    if (ev) {
      const preset = presetByKey(ev.preset);
      const choices: [TemplateKey | "preset", string, string][] = [
        ["preset", `${preset.name} (the series look)`, "The template this series always uses, filled from the event."],
        ...(Object.keys(TEMPLATES) as TemplateKey[])
          .filter((t) => t !== preset.template)
          .map((t): [TemplateKey, string, string] => [t, TEMPLATES[t].name, t === "recap" ? "Numbers after the event: turnout and RSVPs." : t === "blank" ? "Ground, grid and logo only, for finishing in Canva." : "Same facts, a different layout."]),
      ];
      return (
        <>
          <header className="page-head">
            <div>
              <h1>New post for {ev.title}</h1>
              <p>
                {fmtDate(ev.startsAt)}. The post starts with the event’s date, room, speakers and partners filled in. The event’s planned posts are on{" "}
                <Link href={`/events/${ev.id}` as Route}>its page</Link>.
              </p>
            </div>
          </header>
          <StartForm eventId={ev.id}>
            <ol className={`ruled ${styles.list}`}>
              {choices.map(([t, name, desc]) => (
                <li key={t} className={styles.choice}>
                  <div className={styles.text}>
                    <h3>{name}</h3>
                    <p>{desc}</p>
                  </div>
                  <StartButton name="template" value={t} label={`Start with ${name}`} />
                </li>
              ))}
            </ol>
          </StartForm>
        </>
      );
    }
  }

  // Standalone posts start from the template gallery, where every design is shown large.
  redirect("/templates");
}

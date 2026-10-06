import { and, asc, eq, gt } from "drizzle-orm";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostThumb } from "@/components/post/PostThumb";
import { requireUser } from "@/lib/auth/session";
import { formatsFor, galleryEntry, sampleSlide, TYPE_LABEL } from "@/lib/brand/gallery";
import { presetByKey } from "@/lib/brand/presets";
import { db, schema } from "@/lib/db";
import { FAMILY_LABEL, FORMAT_LABEL, SIZES } from "@/lib/posts/types";
import { daysAgo, fmtDate } from "@/lib/time";
import { StartFromTemplate } from "./StartFromTemplate";
import styles from "../templates.module.css";
import own from "./template.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const g = galleryEntry((await params).id);
  return { title: g ? `${g.name} template` : "Template not found" };
}

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const g = galleryEntry((await params).id);
  if (!g) notFound();
  const sample = sampleSlide(g);
  const formats = formatsFor(g);
  const events = await db()
    .select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt })
    .from(schema.events)
    .where(and(eq(schema.events.status, "planned"), gt(schema.events.startsAt, daysAgo(30))))
    .orderBy(asc(schema.events.startsAt))
    .limit(40);

  return (
    <>
      <header className="page-head">
        <div>
          <p className={own.crumb}>
            <Link href={"/templates" as Route}>Templates</Link> / {TYPE_LABEL[g.type]}
          </p>
          <h1>{g.name}</h1>
          <p>{g.use}</p>
        </div>
      </header>
      <div className={own.layout}>
        <section className={own.previews} aria-label="Preview in every size, with sample words">
          {formats.map((f) => (
            <figure key={f} className={own.preview}>
              <PostThumb slide={sample} format={f} width={f === "wide" ? 480 : f === "story" ? 220 : 340} />
              <figcaption>
                {FORMAT_LABEL[f]} <span className="muted">· {SIZES[f][0]} × {SIZES[f][1]}</span>
              </figcaption>
            </figure>
          ))}
          <p className={own.note}>
            {FAMILY_LABEL[g.family]}. Sample words and stand-in pictures; your post starts empty, with the same structure.
          </p>
        </section>
        <aside className={`panel ${own.start}`}>
          <h2>Start a post</h2>
          <StartFromTemplate
            template={g.id}
            series={presetByKey(g.preset).fields.series ?? ""}
            formats={formats.map((f) => [f, FORMAT_LABEL[f]] as [string, string])}
            events={events.map((e) => ({ id: e.id, label: `${e.title} · ${fmtDate(e.startsAt)}` }))}
          />
        </aside>
      </div>
      <p className={styles.use} style={{ marginBlockStart: "var(--space-l)" }}>
        <Link href={"/templates" as Route}>Back to every template</Link>
      </p>
    </>
  );
}

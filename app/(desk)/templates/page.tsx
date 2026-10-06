import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostThumb } from "@/components/post/PostThumb";
import { GALLERY, sampleSlide, TYPE_LABEL, type GalleryType } from "@/lib/brand/gallery";
import { FAMILY_LABEL, type FamilyKey } from "@/lib/posts/types";
import styles from "./templates.module.css";

export const metadata: Metadata = { title: "Templates" };

const FAMILIES: (FamilyKey | "all")[] = ["all", "signal", "shock", "field", "classic"];
const TYPES: (GalleryType | "all")[] = ["all", "announcement", "speaker", "photos", "news", "recap", "canvas"];

function href(family: string, type: string): Route {
  const q = new URLSearchParams();
  if (family !== "all") q.set("family", family);
  if (type !== "all") q.set("type", type);
  const s = q.toString();
  return (s ? `/templates?${s}` : "/templates") as Route;
}

/** Every design a post can start from, drawn with sample words. Pick one to start a post. */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ family?: string; type?: string }> }) {
  const sp = await searchParams;
  const family = FAMILIES.includes(sp.family as FamilyKey) ? (sp.family as FamilyKey) : "all";
  const type = TYPES.includes(sp.type as GalleryType) ? (sp.type as GalleryType) : "all";
  const list = GALLERY.filter((g) => (family === "all" || g.family === family) && (type === "all" || g.type === type));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Templates</h1>
          <p>Every post design the club uses. Pick one to start a post on its own, or link it to an event so the date, room and speakers fill in. Previews use sample words.</p>
        </div>
      </header>

      <nav className={styles.filters} aria-label="Filter templates">
        <div className={styles.filterRow}>
          <span className={styles.filterLabel} id="f-family">Family</span>
          <ul aria-labelledby="f-family">
            {FAMILIES.map((f) => (
              <li key={f}>
                <Link href={href(f, type)} aria-current={f === family ? "true" : undefined} className={styles.filter}>
                  {f === "all" ? "All" : FAMILY_LABEL[f].split(":")[0]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel} id="f-type">For</span>
          <ul aria-labelledby="f-type">
            {TYPES.map((t) => (
              <li key={t}>
                <Link href={href(family, t)} aria-current={t === type ? "true" : undefined} className={styles.filter}>
                  {t === "all" ? "Everything" : TYPE_LABEL[t]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {list.length ? (
        <ul className={styles.grid}>
          {list.map((g) => (
            <li key={g.id}>
              <Link href={`/templates/${g.id}` as Route} className={styles.card}>
                <span className={styles.stage}>
                  <PostThumb slide={sampleSlide(g)} format="feed" width={232} />
                </span>
                <span className={styles.meta}>
                  <b>{g.name}</b>
                  <span className={styles.fam}>{FAMILY_LABEL[g.family].split(":")[0]}</span>
                </span>
                <span className={styles.use}>{g.use}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          <strong>No templates match both filters.</strong>
          <Link href={"/templates" as Route}>Show every template</Link>
        </p>
      )}
    </>
  );
}

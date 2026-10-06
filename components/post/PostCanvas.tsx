import type { CSSProperties, ReactNode } from "react";
import { FamilyCanvas } from "./families";
import {
  familyDraws,
  SIZES,
  type Format,
  type ImageRef,
  type PartnerLogo,
  type Slide,
  type SlideFields,
  type TemplateKey,
} from "@/lib/posts/types";

/**
 * The club's post templates, ported from the original desk's design-system bundle. Markup and
 * class names are unchanged so styles/post.css (copied verbatim) draws them identically.
 * Pure and server-safe: no hooks, no browser APIs.
 *
 * EDITOR CONTRACT: every editable text element carries data-field="<path in SlideFields>"
 * ("headline", "meta.1.value", "speakers.0.name", "stats.2.label"); photo frames carry
 * data-slot ("speakers.0", "images.1"). Any new template must keep both.
 */

export const LOGO = { black: "/brand/logo-black.png", white: "/brand/logo-white.png" };
const SPARK = "M72 0C72 32 112 72 144 72C112 72 72 112 72 144C72 112 32 72 0 72C32 72 72 32 72 0Z";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const words = (s: string | undefined) => (String(s ?? "").trim().match(/\S+/g) ?? []).length;
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);

type P = SlideFields & { format: Format; scale?: number };

function Spark() {
  return (
    <svg className="aic-spark" viewBox="0 0 144 144" aria-hidden="true" focusable="false">
      <path d={SPARK} />
    </svg>
  );
}

/** A photo slot. data-slot lets the editor drag, zoom and drop onto it. */
export function Photo(p: { img: ImageRef | null | undefined; slot: string; bw?: boolean; className?: string; label?: string; alt?: string }) {
  const im = p.img;
  const cls = cx("aic-photo", !im?.src && "is-empty", p.bw && "is-bw", p.className);
  if (!im?.src) {
    return (
      <div className={cls} data-slot={p.slot} aria-hidden="true">
        <span>{p.label ?? "Photo"}</span>
      </div>
    );
  }
  const x = num(im.x, 50);
  const y = num(im.y, 50);
  const z = Math.max(1, num(im.zoom, 1));
  return (
    <div className={cls} data-slot={p.slot} role="img" aria-label={im.alt || p.alt || ""}>
      {/* eslint-disable-next-line @next/next/no-img-element -- exported pixel-exact, next/image would rewrite the URL */}
      <img
        src={im.src}
        alt=""
        draggable={false}
        crossOrigin="anonymous"
        style={{ objectPosition: `${x}% ${y}%`, transform: z !== 1 ? `scale(${z})` : undefined, transformOrigin: `${x}% ${y}%` }}
      />
    </div>
  );
}

function partnerList(p: P): PartnerLogo[] {
  return (p.partners ?? []).filter((x) => x?.src).slice(0, 3);
}

function PLogos({ p }: { p: P }) {
  return (
    <>
      {partnerList(p).map((x, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          className={cx("aic-plogo", x.tone && x.tone !== "original" && `is-${x.tone}`)}
          src={x.src}
          alt={x.name || "Partner logo"}
          crossOrigin="anonymous"
        />
      ))}
    </>
  );
}

function Head({ p }: { p: P }) {
  const ours = (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="aic-logo" src={p.ground === "ink" ? LOGO.white : LOGO.black} alt="AI Club, Wichita State University" />
  );
  const lock =
    p.partnerPlace === "header" && partnerList(p).length ? (
      <div className="aic-lockup">
        {ours}
        <span className="aic-lock-rule" aria-hidden="true" />
        <PLogos p={p} />
      </div>
    ) : (
      ours
    );
  return (
    <header className="aic-head">
      {lock}
      {p.series ? <span className="aic-eyebrow" data-field="series">{p.series}</span> : null}
    </header>
  );
}

function Kicker({ p }: { p: P }) {
  return p.kicker ? (
    <p className="aic-kicker" data-field="kicker">
      <Spark />
      <span>{p.kicker}</span>
    </p>
  ) : null;
}

function Headline({ p }: { p: P }) {
  return p.headline ? <p className={cx("aic-h", words(p.headline) > 8 && "is-long")} data-field="headline">{p.headline}</p> : null;
}

/** A blank line starts a new paragraph; a single line break stays a line break (pre-line). */
function Dek({ p }: { p: P }) {
  if (!p.dek) return null;
  return (
    <>
      {p.dek
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t, i) => (
          <p key={i} className="aic-dek" data-field="dek">
            {t}
          </p>
        ))}
    </>
  );
}

function Strip({ p }: { p: P }) {
  // Keep each cell's original index: data-field paths must point at the real meta entry.
  const m = (p.meta ?? []).map((x, i) => ({ x, i })).filter(({ x }) => x && (x.label || x.value)).slice(0, 4);
  if (!m.length) return null;
  return (
    <dl className="aic-strip" style={{ "--n": m.length } as CSSProperties}>
      {m.map(({ x, i }) => (
        <div key={i} className="aic-cell">
          <dt data-field={`meta.${i}.label`}>{x.label}</dt>
          <dd data-field={`meta.${i}.value`}>{x.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Foot({ p }: { p: P }) {
  const partners =
    p.partnerPlace !== "header" && p.partnerPlace !== "none" && partnerList(p).length ? (
      <div className="aic-partners">
        <span>{p.partnerLabel || "In partnership with"}</span>
        <PLogos p={p} />
      </div>
    ) : null;
  const foot =
    p.cta || p.page ? (
      <footer className="aic-foot">
        <span data-field="cta">{p.cta || ""}</span>
        <span data-field="page">{p.page || ""}</span>
      </footer>
    ) : null;
  return (
    <>
      {partners}
      {foot}
    </>
  );
}

function Frame({ p, kind, extra, children }: { p: P; kind: TemplateKey; extra?: string | false | null; children: ReactNode }) {
  const fmt = SIZES[p.format] ? p.format : "feed";
  const [w, h] = SIZES[fmt];
  const sc = p.scale ?? 1;
  const post = (
    <div
      className={cx("aic-post", `aic-${fmt}`, `aic-g-${p.ground === "ink" ? "ink" : "paper"}`, `aic-k-${kind}`, extra)}
      style={sc !== 1 ? { transform: `scale(${sc})` } : undefined}
      data-format={fmt}
    >
      {children}
    </div>
  );
  return sc === 1 ? post : (
    <div className="aic-fit" style={{ width: Math.round(w * sc), height: Math.round(h * sc) }}>
      {post}
    </div>
  );
}

/** Full bleed: the photo covers the canvas under a scrim; type sits on it in ivory. */
function Bleed({ p, kind, img, slot, children }: { p: P; kind: TemplateKey; img: ImageRef | null | undefined; slot: string; children: ReactNode }) {
  const q = { ...p, ground: "ink" as const };
  return (
    <Frame p={q} kind={kind} extra="aic-is-bleed">
      <Photo img={img} slot={slot} bw={q.bw} className="aic-bg" label="Full-bleed photo" />
      <div className="aic-scrim" />
      <Head p={q} />
      <div className="aic-main">{children}</div>
      <Foot p={q} />
    </Frame>
  );
}

function EventPost(p: P) {
  return (
    <Frame p={p} kind="event">
      <Head p={p} />
      <div className="aic-main">
        <div className="aic-copy">
          <Kicker p={p} />
          <Headline p={p} />
          <Dek p={p} />
        </div>
        <Strip p={p} />
      </div>
      <Foot p={p} />
    </Frame>
  );
}

function SpeakerPost(p: P) {
  const sp = (p.speakers?.length ? p.speakers : [{ name: "", role: "", photo: null }]).slice(0, 4);
  const n = sp.length;
  if (p.bleed && n === 1) {
    const s0 = sp[0]!;
    return (
      <Bleed p={p} kind="speaker" img={s0.photo} slot="speakers.0">
        <div className="aic-copy">
          <Kicker p={p} />
          {s0.name ? <p className="aic-name" data-field="speakers.0.name">{s0.name}</p> : null}
          {s0.role ? <p className="aic-role" data-field="speakers.0.role">{s0.role}</p> : null}
          <Headline p={p} />
        </div>
        <Strip p={p} />
      </Bleed>
    );
  }
  return (
    <Frame p={p} kind="speaker" extra={`aic-n-${n}`}>
      <Head p={p} />
      <div className="aic-main">
        <div className="aic-speakers" style={{ "--n": n } as CSSProperties}>
          {sp.map((s, i) => (
            <div key={i} className="aic-spk">
              <Photo img={s.photo} slot={`speakers.${i}`} bw={p.bw} label="Speaker photo" alt={s.photo?.alt || `Photo of ${s.name || "the speaker"}`} />
              {s.name ? <p className="aic-name" data-field={`speakers.${i}.name`}>{s.name}</p> : null}
              {s.role ? <p className="aic-role" data-field={`speakers.${i}.role`}>{s.role}</p> : null}
            </div>
          ))}
        </div>
        <div className="aic-copy">
          <Kicker p={p} />
          <Headline p={p} />
        </div>
        <Strip p={p} />
      </div>
      <Foot p={p} />
    </Frame>
  );
}

function GeneralPost(p: P) {
  const imgs = p.images ?? [];
  const lay = p.layout ?? "photo";
  const copy = (
    <div className="aic-copy">
      <Kicker p={p} />
      <Headline p={p} />
      <Dek p={p} />
    </div>
  );
  if (lay === "full") {
    return (
      <Bleed p={p} kind="general" img={imgs[0]} slot="images.0">
        {copy}
        <Strip p={p} />
      </Bleed>
    );
  }
  let media: ReactNode = null;
  if (lay === "photo") media = <Photo img={imgs[0]} slot="images.0" bw={p.bw} className="aic-media" label="Photo" />;
  if (lay === "grid") {
    const n = Math.min(Math.max(imgs.length, 2), 4);
    media = (
      <div className={`aic-grid aic-grid-${n}`}>
        {Array.from({ length: n }, (_, i) => (
          <Photo key={i} img={imgs[i]} slot={`images.${i}`} bw={p.bw} label={`Photo ${i + 1}`} />
        ))}
      </div>
    );
  }
  return (
    <Frame p={p} kind="general" extra={`aic-l-${lay}`}>
      <Head p={p} />
      <div className="aic-main">
        {media}
        {copy}
        <Strip p={p} />
      </div>
      <Foot p={p} />
    </Frame>
  );
}

function RecapPost(p: P) {
  const stats = (p.stats ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.value || s.label).slice(0, 4);
  return (
    <Frame p={p} kind="recap">
      <Head p={p} />
      <div className="aic-main">
        <div className="aic-copy">
          <Kicker p={p} />
          <Headline p={p} />
        </div>
        {stats.length ? (
          <div className={cx("aic-stats", stats.length < 3 && "is-row")}>
            {stats.map((s) => (
              <div key={s.i} className="aic-stat">
                <b data-field={`stats.${s.i}.value`}>{s.value}</b>
                <span data-field={`stats.${s.i}.label`}>{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <Foot p={p} />
    </Frame>
  );
}

/** A branded empty canvas: ground, optional ledger grid, header and footer. For finishing in Canva. */
function BlankPost(p: P) {
  return (
    <Frame p={p} kind="blank" extra={p.grid === false ? "aic-nogrid" : null}>
      {p.header !== false ? <Head p={p} /> : null}
      <div className="aic-main" />
      <Foot p={p} />
    </Frame>
  );
}

const BY_TEMPLATE: Record<TemplateKey, (p: P) => ReactNode> = {
  event: EventPost,
  speaker: SpeakerPost,
  general: GeneralPost,
  recap: RecapPost,
  blank: BlankPost,
};

/** Draws one slide at a format and scale. scale 1 is the export size. */
export function PostCanvas({ slide, format, scale = 1 }: { slide: Slide; format: Format; scale?: number }) {
  const family = slide.family ?? "classic";
  if (family !== "classic" && familyDraws(family, slide.template, slide.fields.layout)) {
    return <FamilyCanvas family={family} template={slide.template} fields={slide.fields} format={format} scale={scale} />;
  }
  const Comp = BY_TEMPLATE[slide.template] ?? EventPost;
  return <Comp {...slide.fields} format={format} scale={scale} />;
}

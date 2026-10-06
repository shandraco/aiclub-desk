import type { CSSProperties, ReactNode } from "react";
import { awnsPath, CHEVRON, earPath, growField, LEAF, SPARK, STEM } from "@/lib/brand/motifs";
import { SIZES, type Format, type ImageRef, type MetaCell, type SlideFields, type TemplateKey } from "@/lib/posts/types";

/**
 * Three template families drawn from the club itself rather than from a generic "tech" look:
 *
 *  - Shock: Shockers gold, the mark's leaves and chevrons rising huge off the edge, condensed
 *    Bricolage type. Loud and unmistakably Wichita State.
 *  - Field: a wheat field grown from the post's own words (seeded), so no two posts are
 *    alike; speakers framed in the mark's leaf. Ideas growing out of the plains.
 *  - Signal: a game-day poster: the date as a giant Big Shoulders numeral, the mark's chevrons
 *    as rhythm, a black ticket bar.
 *
 * Editor contract (same as PostCanvas): editable text carries data-field, photo frames data-slot.
 * Pure and server-safe.
 */

export type Family = "shock" | "field" | "signal";
type P = SlideFields & { format: Format; template: TemplateKey };

const LOGO = { black: "/brand/logo-black.png", white: "/brand/logo-white.png" };
const words = (s: string | undefined) => (String(s ?? "").trim().match(/\S+/g) ?? []).length;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
/** Non-empty data-strip cells, each keeping its original index for its data-field path. */
const metaOf = (p: P) => (p.meta ?? []).map((m, i) => ({ ...m, i })).filter((m) => m.label || m.value).slice(0, 4);
type Cell = MetaCell & { i: number };

/** Headline size class by length, so long talk titles still fit without a manual setting. */
function hClass(text: string) {
  const n = words(text);
  return n > 9 ? "is-xl" : n > 6 ? "is-l" : n > 3 ? "is-m" : "is-s";
}

/* ---------------- shared bits ---------------- */

function Photo({ img, slot, className, label = "Photo", style }: { img: ImageRef | null | undefined; slot: string; className?: string; label?: string; style?: CSSProperties }) {
  if (!img?.src) {
    return (
      <div className={cx("fm-photo", "is-empty", className)} data-slot={slot} style={style} aria-hidden="true">
        <span>{label}</span>
      </div>
    );
  }
  const x = Number.isFinite(Number(img.x)) ? Number(img.x) : 50;
  const y = Number.isFinite(Number(img.y)) ? Number(img.y) : 50;
  const z = Math.max(1, Number(img.zoom) || 1);
  return (
    <div className={cx("fm-photo", className)} data-slot={slot} role="img" aria-label={img.alt ?? ""} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} alt="" draggable={false} crossOrigin="anonymous" style={{ objectPosition: `${x}% ${y}%`, transform: z !== 1 ? `scale(${z})` : undefined, transformOrigin: `${x}% ${y}%` }} />
    </div>
  );
}

function Logo({ light }: { light: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="fm-logo" src={light ? LOGO.white : LOGO.black} alt="AI Club, Wichita State University" />;
}

function Partners({ p, light }: { p: P; light: boolean }) {
  const list = (p.partners ?? []).filter((x) => x?.src).slice(0, 3);
  if (!list.length || p.partnerPlace === "none") return null;
  return (
    <div className="fm-partners">
      <span>{p.partnerLabel || "With"}</span>
      {list.map((x, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={x.src} alt={x.name || "Partner logo"} crossOrigin="anonymous" className={cx(x.tone === "white" && "is-white", x.tone === "black" && "is-black", x.tone === "original" && light && "is-plate")} />
      ))}
    </div>
  );
}

function Cells({ meta, className }: { meta: Cell[]; className?: string }) {
  if (!meta.length) return null;
  return (
    <dl className={cx("fm-cells", className)} style={{ "--n": meta.length } as CSSProperties}>
      {meta.map((m) => (
        <div key={m.i}>
          <dt data-field={`meta.${m.i}.label`}>{m.label}</dt>
          <dd data-field={`meta.${m.i}.value`}>{m.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Paras({ text, className }: { text: string; className: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t, i) => (
          <p key={i} className={className} data-field="dek">
            {t}
          </p>
        ))}
    </>
  );
}

function Foot({ p }: { p: P }) {
  if (!p.cta && !p.page) return null;
  return (
    <footer className="fm-foot">
      <span data-field="cta">{p.cta}</span>
      <span data-field="page">{p.page}</span>
    </footer>
  );
}

function Root({ family, p, extra, children }: { family: Family; p: P; extra?: string; children: ReactNode }) {
  return (
    <div className={cx("fm", `fm-${family}`, `fm-${p.format}`, `fm-t-${p.template}`, `fm-g-${p.ground}`, extra)} data-format={p.format}>
      {children}
    </div>
  );
}

/* ---------------- Shock ---------------- */

/** The mark's right half, rebuilt as a tall column: chevrons up the middle, leaves either side, stem and spark on top. */
function ShockColumn({ rows }: { rows: number }) {
  const parts: ReactNode[] = [];
  const rowH = 128;
  for (let r = 0; r < rows; r++) {
    const y = 300 + r * rowH;
    parts.push(<path key={`c${r}`} d={CHEVRON} transform={`translate(95 ${y})`} />);
    parts.push(<path key={`l${r}`} d={LEAF} transform={`translate(0 ${y - 70}) scale(-1 1) translate(-130 0) rotate(8 65 60)`} />);
    parts.push(<path key={`r${r}`} d={LEAF} transform={`translate(210 ${y - 70}) rotate(-8 65 60)`} />);
  }
  return (
    <svg className="sh-column" viewBox={`0 0 340 ${300 + rows * rowH + 40}`} aria-hidden="true">
      <path d={STEM} transform="translate(159 150)" />
      <path d={SPARK} transform="translate(98 0) scale(0.99)" className="sh-spark" />
      {parts}
    </svg>
  );
}

function Shock(p: P) {
  const light = p.ground === "ink";
  const meta = metaOf(p);
  if (p.template === "speaker") {
    const sp = (p.speakers?.length ? p.speakers : [{ name: "", role: "", photo: null }]).slice(0, 4);
    return (
      <Root family="shock" p={{ ...p, ground: "ink" }} extra={`sh-n-${sp.length}`}>
        <div className="sh-photos">
          {sp.map((s, i) => (
            <div key={i} className="sh-spk">
              <Photo img={s.photo} slot={`speakers.${i}`} className="sh-duo" label="Speaker photo" />
              <div className="sh-who">
                {s.name ? <p className="sh-name" data-field={`speakers.${i}.name`}>{s.name}</p> : null}
                {s.role ? <p className="sh-role" data-field={`speakers.${i}.role`}>{s.role}</p> : null}
              </div>
            </div>
          ))}
        </div>
        <header className="fm-head">
          <Logo light />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        <div className="sh-body">
          {p.kicker ? <p className="sh-kicker" data-field="kicker">{p.kicker}</p> : null}
          {p.headline ? <p className={cx("sh-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
          <Cells meta={meta} className="sh-ticket" />
          <Partners p={p} light />
          <Foot p={p} />
        </div>
      </Root>
    );
  }
  if (p.template === "recap") {
    const stats = (p.stats ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.value || s.label).slice(0, 4);
    return (
      <Root family="shock" p={p}>
        <ShockColumn rows={6} />
        <header className="fm-head">
          <Logo light={light} />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        <div className="sh-body">
          {p.headline ? <p className={cx("sh-h", "sh-h-recap", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
          <div className={cx("sh-stats", `sh-stats-${stats.length}`)}>
            {stats.map((s) => (
              <div key={s.i}>
                <b data-field={`stats.${s.i}.value`}>{s.value}</b>
                <span data-field={`stats.${s.i}.label`}>{s.label}</span>
              </div>
            ))}
          </div>
          <Foot p={p} />
        </div>
      </Root>
    );
  }
  return (
    <Root family="shock" p={p}>
      <ShockColumn rows={7} />
      <header className="fm-head">
        <Logo light={light} />
        {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
      </header>
      <div className="sh-body">
        {p.kicker ? <p className="sh-kicker" data-field="kicker">{p.kicker}</p> : null}
        {p.headline ? <p className={cx("sh-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
        {p.dek ? <Paras text={p.dek} className="sh-dek" /> : null}
        <Cells meta={meta} className="sh-ticket" />
        <Partners p={p} light={light} />
        <Foot p={p} />
      </div>
    </Root>
  );
}

/* ---------------- Field ---------------- */

function FieldArt({ seed, w, h, top, density }: { seed: string; w: number; h: number; top: number; density?: number }) {
  const field = growField(seed, w, h, top, density);
  return (
    <svg className="fd-field" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {field.stalks.map((s, i) => (
        <g key={i} opacity={s.opacity.toFixed(2)} className={s.gold ? "fd-gold" : "fd-plain"}>
          <path d={s.d} className="fd-stem" strokeWidth={s.stroke.toFixed(2)} fill="none" />
          <g transform={`translate(${s.hx.toFixed(1)} ${s.hy.toFixed(1)}) rotate(${s.angle.toFixed(1)})`}>
            <path d={earPath(s.length, s.width)} className="fd-ear" />
            <path d={awnsPath(s.length)} className="fd-awn" fill="none" strokeWidth={(s.stroke * 0.7).toFixed(2)} />
          </g>
        </g>
      ))}
      <path d={SPARK} className="fd-spark" transform={`translate(${(field.spark.x - field.spark.size / 2).toFixed(1)} ${(field.spark.y - field.spark.size / 2).toFixed(1)}) scale(${(field.spark.size / 144).toFixed(3)})`} />
    </svg>
  );
}

function Field(input: P) {
  // Field has no gold design: a gold ground draws as black.
  const p: P = input.ground === "gold" ? { ...input, ground: "ink" } : input;
  const [w, h] = SIZES[p.format];
  const meta = metaOf(p);
  const seed = `${p.headline}|${p.series}`;
  const fieldTop = p.format === "wide" ? h * 0.6 : p.template === "speaker" ? h * 0.87 : p.template === "recap" ? h * 0.8 : p.format === "story" ? h * 0.62 : h * 0.64;
  const light = p.ground !== "paper";
  if (p.template === "speaker") {
    const sp = (p.speakers?.length ? p.speakers : [{ name: "", role: "", photo: null }]).slice(0, 4);
    return (
      <Root family="field" p={p} extra={`fd-n-${sp.length}`}>
        <FieldArt seed={seed} w={w} h={h} top={fieldTop} density={40} />
        <header className="fm-head">
          <Logo light={light} />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        <div className="fd-speakers">
          {sp.map((s, i) => (
            <div key={i} className="fd-spk">
              <Photo img={s.photo} slot={`speakers.${i}`} className="fd-capsule" label="Speaker photo" />
              <div>
                {s.name ? <p className="fd-name" data-field={`speakers.${i}.name`}>{s.name}</p> : null}
                {s.role ? <p className="fd-role" data-field={`speakers.${i}.role`}>{s.role}</p> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="fd-body">
          {p.kicker ? <p className="fd-kicker" data-field="kicker">{p.kicker}</p> : null}
          {p.headline ? <p className={cx("fd-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
          <Cells meta={meta} className="fd-cells" />
        </div>
        <Partners p={p} light={light} />
        <Foot p={p} />
      </Root>
    );
  }
  if (p.template === "recap") {
    const stats = (p.stats ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.value || s.label).slice(0, 4);
    return (
      <Root family="field" p={p}>
        <FieldArt seed={seed} w={w} h={h} top={fieldTop} density={64} />
        <header className="fm-head">
          <Logo light={light} />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        <div className="fd-body">
          {p.headline ? <p className={cx("fd-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
          <div className="fd-stats">
            {stats.map((s) => (
              <div key={s.i}>
                <b data-field={`stats.${s.i}.value`}>{s.value}</b>
                <span data-field={`stats.${s.i}.label`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <Foot p={p} />
      </Root>
    );
  }
  if (p.template === "general" && p.layout && p.layout !== "text") {
    const imgs = p.images ?? [];
    if (p.layout === "full") {
      return (
        <Root family="field" p={{ ...p, ground: "ink" }} extra="fd-full">
          <Photo img={imgs[0]} slot="images.0" className={cx("fd-bleed", p.bw && "is-bw")} label="Full-bleed photo" />
          <div className="fd-scrim" />
          <FieldArt seed={seed} w={w} h={h} top={h * 0.9} density={30} />
          <header className="fm-head">
            <Logo light />
            {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
          </header>
          <div className="fd-body fd-body-low">
            {p.kicker ? <p className="fd-kicker" data-field="kicker">{p.kicker}</p> : null}
            {p.headline ? <p className={cx("fd-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
            {p.dek ? <Paras text={p.dek} className="fd-dek" /> : null}
          </div>
          <Foot p={p} />
        </Root>
      );
    }
    const n = p.layout === "grid" ? Math.min(Math.max(imgs.length, 2), 4) : 1;
    return (
      <Root family="field" p={p} extra={`fd-media-${n}`}>
        <FieldArt seed={seed} w={w} h={h} top={h * 0.9} density={40} />
        <header className="fm-head">
          <Logo light={light} />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        <div className={cx("fd-media", `fd-media-n${n}`)}>
          {Array.from({ length: n }, (_, i) => (
            <Photo key={i} img={imgs[i]} slot={`images.${i}`} className={cx(p.bw && "is-bw")} label={n > 1 ? `Photo ${i + 1}` : "Photo"} />
          ))}
        </div>
        <div className="fd-body fd-body-tight">
          {p.kicker ? <p className="fd-kicker" data-field="kicker">{p.kicker}</p> : null}
          {p.headline ? <p className={cx("fd-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
          {p.dek ? <Paras text={p.dek} className="fd-dek" /> : null}
        </div>
        <Foot p={p} />
      </Root>
    );
  }
  return (
    <Root family="field" p={p}>
      <FieldArt seed={seed} w={w} h={h} top={fieldTop} />
      <header className="fm-head">
        <Logo light={light} />
        {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
      </header>
      <div className="fd-body">
        {p.kicker ? <p className="fd-kicker" data-field="kicker">{p.kicker}</p> : null}
        {p.headline ? <p className={cx("fd-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
        {p.dek ? <Paras text={p.dek} className="fd-dek" /> : null}
        <Cells meta={meta} className="fd-cells" />
      </div>
      <Partners p={p} light={light} />
      <Foot p={p} />
    </Root>
  );
}

/* ---------------- Signal ---------------- */

/** "Thu, Oct 15" -> { weekday: "Thursday", month: "October", day: "15" }; null if it isn't a single date. */
const DAYS: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const MONTHS: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
function bigDate(meta: Cell[]): { weekday: string; month: string; day: string; index: number; pos: number } | null {
  const pos = meta.findIndex((m) => /^dates?$/i.test(m.label));
  if (pos < 0) return null;
  const m = /^(?:(\w{3})\w*,?\s+)?(\w{3})\w*\s+(\d{1,2})$/.exec(meta[pos]!.value.trim());
  if (!m) return null;
  return { weekday: (m[1] && DAYS[m[1]]) || "", month: MONTHS[m[2]!] ?? m[2]!, day: m[3]!, index: meta[pos]!.i, pos };
}

function Chevrons({ n = 3, className }: { n?: number; className?: string }) {
  return (
    <svg className={cx("sg-chev", className)} viewBox={`0 0 150 ${130 + (n - 1) * 70}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={CHEVRON} transform={`translate(0 ${i * 70})`} />
      ))}
    </svg>
  );
}

function Signal(p: P) {
  const light = p.ground === "ink";
  const meta = metaOf(p);
  const date = bigDate(meta);
  const rest = date ? meta.filter((_, k) => k !== date.pos) : meta;
  if (p.template === "speaker") {
    const sp = (p.speakers?.length ? p.speakers : [{ name: "", role: "", photo: null }]).slice(0, 4);
    return (
      <Root family="signal" p={p} extra={`sg-n-${sp.length}`}>
        <header className="fm-head">
          <Logo light={light} />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        <div className="sg-speakers">
          {sp.map((s, i) => (
            <div key={i} className="sg-spk">
              <Photo img={s.photo} slot={`speakers.${i}`} className="sg-photo" label="Speaker photo" />
              {s.name ? <p className="sg-name" data-field={`speakers.${i}.name`}>{s.name}</p> : null}
              {s.role ? <p className="sg-role" data-field={`speakers.${i}.role`}>{s.role}</p> : null}
            </div>
          ))}
        </div>
        <div className="sg-body">
          {p.kicker ? <p className="sg-kicker" data-field="kicker">{p.kicker}</p> : null}
          {p.headline ? <p className={cx("sg-h", "sg-h-talk", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
        </div>
        <div className="sg-bar">
          {date ? (
            <p className="sg-bar-date">
              <b data-field={`meta.${date.index}.value`}>{date.month.slice(0, 3)} {date.day}</b>
            </p>
          ) : null}
          <Cells meta={rest} className="sg-bar-cells" />
          <span className="sg-bar-cta" data-field="cta">{p.cta}</span>
        </div>
      </Root>
    );
  }
  if (p.template === "recap") {
    const stats = (p.stats ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.value || s.label).slice(0, 4);
    return (
      <Root family="signal" p={p}>
        <header className="fm-head">
          <Logo light={light} />
          {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
        </header>
        {p.headline ? <p className={cx("sg-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
        <div className="sg-stats">
          {stats.map((s) => (
            <div key={s.i}>
              <b data-field={`stats.${s.i}.value`}>{s.value}</b>
              <Chevrons n={1} className="sg-stat-chev" />
              <span data-field={`stats.${s.i}.label`}>{s.label}</span>
            </div>
          ))}
        </div>
        <Foot p={p} />
      </Root>
    );
  }
  return (
    <Root family="signal" p={p} extra={date ? "sg-dated" : "sg-undated"}>
      <header className="fm-head">
        <Logo light={light} />
        {p.series ? <span className="fm-series" data-field="series">{p.series}</span> : null}
      </header>
      {date ? (
        <div className="sg-date">
          <p className="sg-when">
            <span>{date.weekday}</span>
            <span>{date.month}</span>
          </p>
          <b className="sg-day" data-field={`meta.${date.index}.value`}>{date.day}</b>
          <Chevrons n={3} />
        </div>
      ) : null}
      <div className="sg-body">
        {p.kicker ? <p className="sg-kicker" data-field="kicker">{p.kicker}</p> : null}
        {p.headline ? <p className={cx("sg-h", hClass(p.headline))} data-field="headline">{p.headline}</p> : null}
        {p.dek ? <Paras text={p.dek} className="sg-dek" /> : null}
      </div>
      <div className="sg-bar">
        <Cells meta={rest} className="sg-bar-cells" />
        <span className="sg-bar-cta" data-field="cta">{p.cta}</span>
      </div>
      <Partners p={p} light={light} />
    </Root>
  );
}

const FAMILIES: Record<Family, (p: P) => ReactNode> = { shock: Shock, field: Field, signal: Signal };

export function FamilyCanvas({ family, template, fields, format, scale = 1 }: { family: Family; template: TemplateKey; fields: SlideFields; format: Format; scale?: number }) {
  const [w, h] = SIZES[format];
  const Comp = FAMILIES[family];
  const post = Comp({ ...fields, format, template });
  if (scale === 1) return <>{post}</>;
  return (
    <div className="fm-fit" style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>{post}</div>
    </div>
  );
}

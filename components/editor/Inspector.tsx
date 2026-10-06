"use client";

import type { ReactNode } from "react";
import { ImageDrop } from "@/components/upload/ImageDrop";
import { words, type Issue } from "@/lib/brand/checks";
import { FAMILY_LABEL, familyDraws, TEMPLATES, type FamilyKey, type GeneralLayout, type Ground, type LogoTone, type PartnerPlace, type Slide, type SlideFields, type TemplateKey } from "@/lib/posts/types";
import type { Selection } from "./CanvasEditor";
import { Check, EInput, EText, fid, IssueList, Seg } from "./fields";
import { PhotoField } from "./PhotoField";
import { getImage, setImage } from "./slots";
import { getText, maxLength, setText, textLabel, textsFor } from "./targets";
import type { LibPartner, LibSpeaker, UploadMode } from "./types";
import styles from "./inspector.module.css";

type FieldsFn = (f: SlideFields) => SlideFields;

const LAYOUTS = [
  ["photo", "Photo"],
  ["grid", "Grid"],
  ["full", "Full bleed"],
  ["text", "Text"],
] as const;
const TONES = [
  ["original", "Original"],
  ["white", "White"],
  ["black", "Black"],
] as const;
const PLACES = [
  ["none", "Off"],
  ["header", "Header"],
  ["footer", "Footer"],
] as const;

function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

function Group({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h3>
        {title}
        {note ? <small>{note}</small> : null}
      </h3>
      {children}
    </section>
  );
}

interface Props {
  slide: Slide;
  index: number;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onFields: (fn: FieldsFn, key?: string) => void;
  onTemplate: (t: TemplateKey) => void;
  onFamily: (f: FamilyKey) => void;
  onEditText: (key: string) => void;
  issuesFor: (path: string) => Issue[];
  speakers: LibSpeaker[];
  partners: LibPartner[];
  uploadMode: UploadMode;
  frames: Record<string, { w: number; h: number }>;
  formatName: string;
  onCrop: (slot: string) => void;
  readOnly: boolean;
}

/**
 * Shows only what applies to what is selected on the canvas: the slide's look and parts when
 * nothing is, the words and their checks for a text element, framing for a photo, the logo
 * for a partner. Everything here is also reachable by keyboard from the canvas.
 */
export function Inspector(p: Props) {
  const { slide, selection } = p;
  let body: ReactNode;
  let title: string;
  if (selection.kind === "text") {
    title = textLabel(selection.key);
    body = <TextInspector {...p} k={selection.key} />;
  } else if (selection.kind === "photo") {
    const [list, n] = selection.slot.split(".");
    title = list === "speakers" ? `Speaker ${Number(n) + 1} photo` : `Photo ${Number(n) + 1}`;
    body = <PhotoInspector {...p} slot={selection.slot} />;
  } else if (selection.kind === "partner") {
    title = `Partner logo ${selection.i + 1}`;
    body = <PartnersGroup {...p} only={selection.i} />;
  } else {
    title = `Slide ${p.index + 1}`;
    body = <SlideInspector {...p} />;
  }
  return (
    <div className={styles.inspector}>
      <div className={styles.head}>
        <h2 id="inspector-h">
          {title}
          {selection.kind === "slide" ? <small>{TEMPLATES[slide.template].name}</small> : null}
        </h2>
        {selection.kind !== "slide" ? (
          <button type="button" className="btn btn-s btn-quiet" onClick={() => p.onSelect({ kind: "slide" })}>
            Slide settings
          </button>
        ) : null}
      </div>
      <fieldset disabled={p.readOnly} className={styles.bare}>
        <legend className="visually-hidden">{title}</legend>
        {body}
      </fieldset>
    </div>
  );
}

/* ---------------- a text element ---------------- */

function TextInspector(p: Props & { k: string }) {
  const { k, slide, index } = p;
  const value = getText(slide.fields, k);
  const issuePath = /^meta\.(\d+)\./.test(k) ? `slides.${index}.meta.${k.split(".")[1]}` : /^stats\./.test(k) ? `slides.${index}.stats` : `slides.${index}.${k}`;
  const wc = words(value);
  const count = k === "headline" ? `${wc} of 12 words` : k === "dek" ? `${wc} of 25 words` : undefined;
  const sp = /^speakers\.(\d+)\./.exec(k);
  return (
    <>
      <EText
        label={textLabel(k)}
        path={`slides.${index}.${k}.inspector`}
        rows={k === "dek" ? 4 : k === "headline" ? 3 : 2}
        value={value}
        maxLength={maxLength(k)}
        onChange={(e) => p.onFields((f) => setText(f, k, e.target.value), k)}
        count={count}
        over={(k === "headline" && wc > 12) || (k === "dek" && wc > 25)}
        hint="Or type straight onto the graphic."
        issues={p.issuesFor(issuePath)}
      />
      <div className="btn-row">
        <button type="button" className="btn btn-s" onClick={() => p.onEditText(k)}>
          Edit on the graphic
        </button>
        {value ? (
          <button type="button" className="btn btn-s btn-quiet" onClick={() => p.onFields((f) => setText(f, k, ""), `${k}:clear`)}>
            Clear
          </button>
        ) : null}
      </div>
      {sp ? <SpeakerGroup {...p} i={Number(sp[1])} /> : null}
      {/^meta\./.test(k) ? <StripGroup {...p} /> : null}
      {/^stats\./.test(k) ? <NumbersGroup {...p} /> : null}
      {k === "partnerLabel" ? <PartnersGroup {...p} /> : null}
    </>
  );
}

/* ---------------- a photo ---------------- */

function PhotoInspector(p: Props & { slot: string }) {
  const { slide, index, slot } = p;
  const f = slide.fields;
  const sp = /^speakers\.(\d+)$/.exec(slot);
  const path = sp ? `slides.${index}.speakers.${sp[1]}.photo` : `slides.${index}.${slot}`;
  return (
    <>
      <PhotoField
        label="Photo"
        path={path}
        img={getImage(f, slot)}
        onChange={(img) => p.onFields((x) => setImage(x, slot, img), `photo:${slot}`)}
        uploadMode={p.uploadMode}
        frame={p.frames[slot]}
        formatName={p.formatName}
        onCrop={() => p.onCrop(slot)}
        issues={p.issuesFor(path)}
      />
      <Check id={fid(`slides.${index}.bw.photo`)} label="Black-and-white photos" checked={!!f.bw} onChange={(v) => p.onFields((x) => ({ ...x, bw: v }), "bw")} />
      {sp ? <SpeakerGroup {...p} i={Number(sp[1])} hidePhoto /> : null}
      {slide.template === "general" ? <Seg label="Layout" name={`layout-p-${slide.id}`} value={f.layout ?? "photo"} options={LAYOUTS} onChange={(v) => p.onFields((x) => withLayout(x, v), "layout")} /> : null}
      <p className={styles.hint}>On the graphic: drag to move, scroll to zoom, double-click to crop, drop a file to replace. With the keyboard: arrow keys move, plus and minus zoom.</p>
    </>
  );
}

function withLayout(x: SlideFields, v: GeneralLayout): SlideFields {
  let images = [...(x.images ?? [])];
  if (v === "grid") while (images.length < 2) images.push(null);
  if (v === "photo" || v === "full") {
    const first = images.find(Boolean) ?? null;
    images = [first, ...images.filter((im) => im && im !== first)];
  }
  return { ...x, layout: v, images };
}

/* ---------------- the slide ---------------- */

/** Grounds each family draws; gold only where the family has a gold design. */
export const GROUNDS: Record<FamilyKey, [Ground, string][]> = {
  shock: [["gold", "Gold"], ["ink", "Black"], ["paper", "Ivory"]],
  signal: [["paper", "Ivory"], ["ink", "Black"], ["gold", "Gold"]],
  field: [["ink", "Black"], ["paper", "Ivory"]],
  classic: [["paper", "Ivory"], ["ink", "Black"]],
};

function SlideInspector(p: Props) {
  const { slide, index } = p;
  const f = slide.fields;
  const t = slide.template;
  const family: FamilyKey = slide.family ?? "classic";
  const sp = f.speakers ?? [];
  const bleed = (t === "speaker" && f.bleed && sp.length === 1) || (t === "general" && f.layout === "full");
  const imgs = f.images ?? [];
  const n = Math.min(Math.max(imgs.length, 2), 4);
  return (
    <>
      <Group title="Look">
        <div className={styles.field}>
          <label htmlFor={fid(`slides.${index}.family`)}>Family</label>
          <select id={fid(`slides.${index}.family`)} className="input" value={family} onChange={(e) => p.onFamily(e.target.value as FamilyKey)}>
            {(Object.keys(FAMILY_LABEL) as FamilyKey[]).map((k) => (
              <option key={k} value={k}>
                {FAMILY_LABEL[k]}
              </option>
            ))}
          </select>
          {!familyDraws(family, t, f.layout) ? <p className={styles.hint}>This family doesn’t draw this layout yet, so it shows in Classic.</p> : null}
        </div>
        <div className={styles.field}>
          <label htmlFor={fid(`slides.${index}.template`)}>Template</label>
          <select id={fid(`slides.${index}.template`)} className="input" value={t} onChange={(e) => p.onTemplate(e.target.value as TemplateKey)}>
            {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
              <option key={k} value={k}>
                {TEMPLATES[k].name}
              </option>
            ))}
          </select>
        </div>
        {bleed ? (
          <p className={styles.hint}>Full bleed: ivory type on the photo, always on black.</p>
        ) : (
          <Seg label="Ground" name={`ground-${slide.id}`} value={f.ground} options={GROUNDS[family]} onChange={(v) => p.onFields((x) => ({ ...x, ground: v }), "ground")} />
        )}
        {t === "general" ? <Seg label="Layout" name={`layout-${slide.id}`} value={f.layout ?? "photo"} options={LAYOUTS} onChange={(v) => p.onFields((x) => withLayout(x, v), "layout")} /> : null}
        {t === "general" && f.layout === "grid" ? (
          <Seg
            label="Photos in the grid"
            name={`count-${slide.id}`}
            value={String(n)}
            options={[["2", "2"], ["3", "3"], ["4", "4"]]}
            onChange={(v) =>
              p.onFields((x) => {
                const images = [...(x.images ?? [])].slice(0, Number(v));
                while (images.length < Number(v)) images.push(null);
                return { ...x, images };
              }, "count")
            }
          />
        ) : null}
        <div className={styles.checks}>
          {t === "speaker" || (t === "general" && f.layout !== "text") ? (
            <Check id={fid(`slides.${index}.bw`)} label="Black-and-white photos" checked={!!f.bw} onChange={(v) => p.onFields((x) => ({ ...x, bw: v }), "bw")} />
          ) : null}
          {t === "speaker" ? (
            <Check id={fid(`slides.${index}.bleed`)} label="Full-bleed portrait" hint={sp.length > 1 ? " Only with one speaker." : undefined} checked={!!f.bleed} onChange={(v) => p.onFields((x) => ({ ...x, bleed: v }), "bleed")} />
          ) : null}
          {t === "blank" ? (
            <>
              <Check id={fid(`slides.${index}.grid`)} label="Ledger grid" checked={f.grid !== false} onChange={(v) => p.onFields((x) => ({ ...x, grid: v }), "grid")} />
              <Check id={fid(`slides.${index}.header`)} label="Logo header" checked={f.header !== false} onChange={(v) => p.onFields((x) => ({ ...x, header: v }), "header")} />
            </>
          ) : null}
        </div>
      </Group>

      <Group title="Words" note="click them on the graphic">
        <ul className={styles.wordList}>
          {textsFor(t).map((k) => {
            const v = getText(f, k);
            const iss = p.issuesFor(`slides.${index}.${k}`);
            return (
              <li key={k}>
                <button type="button" className={styles.wordBtn} onClick={() => p.onEditText(k)} data-path={`slides.${index}.${k}`}>
                  <span className={styles.wordName}>{textLabel(k)}</span>
                  <span className={v ? styles.wordVal : styles.wordAdd}>{v ? v.replace(/\s+/g, " ").slice(0, 60) : "Add"}</span>
                </button>
                <IssueList issues={iss} />
              </li>
            );
          })}
        </ul>
      </Group>

      {t === "speaker" ? <SpeakersList {...p} /> : null}
      {t === "recap" ? <NumbersGroup {...p} /> : null}
      {t === "event" || t === "speaker" || t === "general" ? <StripGroup {...p} /> : null}
      <PartnersGroup {...p} />
    </>
  );
}

/* ---------------- speakers ---------------- */

function SpeakersList(p: Props) {
  const sp = p.slide.fields.speakers ?? [];
  return (
    <Group title="Speakers" note={`${sp.length} of 4`}>
      <ol className={styles.rows}>
        {sp.map((s, i) => (
          <li key={i} className={styles.row}>
            <button type="button" className={styles.wordBtn} onClick={() => p.onSelect({ kind: "photo", slot: `speakers.${i}` })}>
              <span className={styles.wordName}>Speaker {i + 1}</span>
              <span className={s.name ? styles.wordVal : styles.wordAdd}>{s.name || "No name yet"}</span>
            </button>
            <span className={styles.tools}>
              <button type="button" className="btn btn-s btn-quiet" disabled={i === 0} aria-label={`Move speaker ${i + 1} up`} onClick={() => p.onFields((x) => ({ ...x, speakers: move(x.speakers ?? [], i, -1) }), "speakers")}>
                Up
              </button>
              <button type="button" className="btn btn-s btn-quiet btn-danger" disabled={sp.length <= 1} aria-label={`Remove speaker ${i + 1}`} onClick={() => p.onFields((x) => ({ ...x, speakers: (x.speakers ?? []).filter((_, k) => k !== i) }), "speakers")}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-s" disabled={sp.length >= 4} onClick={() => p.onFields((x) => ({ ...x, speakers: [...(x.speakers ?? []), { name: "", role: "", photo: null }] }), "speakers")}>
        Add a speaker
      </button>
    </Group>
  );
}

function SpeakerGroup(p: Props & { i: number; hidePhoto?: boolean }) {
  const { i, index } = p;
  const s = p.slide.fields.speakers?.[i];
  if (!s) return null;
  const setS = (patch: Partial<typeof s>, key: string) => p.onFields((x) => ({ ...x, speakers: (x.speakers ?? []).map((y, k) => (k === i ? { ...y, ...patch } : y)) }), key);
  return (
    <Group title={`Speaker ${i + 1}`}>
      {p.speakers.length ? (
        <div className={styles.field}>
          <label htmlFor={fid(`slides.${index}.speakers.${i}.lib`)}>From the library</label>
          <select
            id={fid(`slides.${index}.speakers.${i}.lib`)}
            className="input"
            value={s.speakerId ?? ""}
            onChange={(e) => {
              const lib = p.speakers.find((x) => x.id === e.target.value);
              if (lib) setS({ name: lib.name, role: lib.role, photo: lib.photo ? { ...lib.photo } : s.photo, speakerId: lib.id }, `speakers.${i}.lib`);
              else setS({ speakerId: undefined }, `speakers.${i}.lib`);
            }}
          >
            <option value="">Not from the library</option>
            {p.speakers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.role ? `, ${x.role}` : ""}
              </option>
            ))}
          </select>
          <span className={styles.hint}>Fills the name, title and photo with its saved framing.</span>
        </div>
      ) : (
        <p className={styles.hint}>Add speakers to the library once and pick them here next time.</p>
      )}
      <EInput label="Name" path={`slides.${index}.speakers.${i}.name`} value={s.name} maxLength={100} onChange={(e) => setS({ name: e.target.value }, `speakers.${i}.name`)} issues={p.issuesFor(`slides.${index}.speakers.${i}.name`)} />
      <EInput label="Title and organization" path={`slides.${index}.speakers.${i}.role`} value={s.role} maxLength={160} placeholder="Data lead · Textron Aviation" onChange={(e) => setS({ role: e.target.value }, `speakers.${i}.role`)} />
      {!p.hidePhoto ? (
        <button type="button" className="btn btn-s" onClick={() => p.onSelect({ kind: "photo", slot: `speakers.${i}` })}>
          Photo and framing
        </button>
      ) : null}
    </Group>
  );
}

/* ---------------- numbers, data strip, partners ---------------- */

function NumbersGroup(p: Props) {
  const { index } = p;
  const stats = p.slide.fields.stats ?? [];
  return (
    <Group title="Numbers" note={`${stats.length} of 4`}>
      <div data-path={`slides.${index}.stats`} tabIndex={-1} className={styles.stack}>
        <IssueList issues={p.issuesFor(`slides.${index}.stats`)} />
        <ol className={styles.rows}>
          {stats.map((s, i) => (
            <li key={i} className={styles.pair}>
              <EInput label={`Number ${i + 1}`} path={`slides.${index}.stats.${i}.value`} value={s.value} maxLength={20} placeholder="84" onChange={(e) => p.onFields((x) => ({ ...x, stats: (x.stats ?? []).map((y, k) => (k === i ? { ...y, value: e.target.value } : y)) }), `stats.${i}.value`)} />
              <EInput label="What it counts" path={`slides.${index}.stats.${i}.label`} value={s.label} maxLength={60} placeholder="Came" onChange={(e) => p.onFields((x) => ({ ...x, stats: (x.stats ?? []).map((y, k) => (k === i ? { ...y, label: e.target.value } : y)) }), `stats.${i}.label`)} />
              <button type="button" className="btn btn-s btn-quiet btn-danger" disabled={stats.length <= 2} aria-label={`Remove number ${i + 1}`} onClick={() => p.onFields((x) => ({ ...x, stats: (x.stats ?? []).filter((_, k) => k !== i) }), "stats")}>
                Remove
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-s" disabled={stats.length >= 4} onClick={() => p.onFields((x) => ({ ...x, stats: [...(x.stats ?? []), { value: "", label: "" }] }), "stats")}>
          Add a number
        </button>
      </div>
    </Group>
  );
}

function StripGroup(p: Props) {
  const { index } = p;
  const meta = p.slide.fields.meta ?? [];
  return (
    <Group title="Data strip" note={`${meta.length} of 4`}>
      {meta.length ? (
        <ol className={styles.rows}>
          {meta.map((m, i) => (
            <li key={i} className={styles.pair} data-path={`slides.${index}.meta.${i}`}>
              <EInput label={`Label ${i + 1}`} path={`slides.${index}.meta.${i}.label`} value={m.label} maxLength={40} placeholder="Date" onChange={(e) => p.onFields((x) => ({ ...x, meta: x.meta.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)) }), `meta.${i}.label`)} />
              <EInput label="Value" path={`slides.${index}.meta.${i}.value`} value={m.value} maxLength={80} placeholder="Thu, Oct 8" onChange={(e) => p.onFields((x) => ({ ...x, meta: x.meta.map((y, k) => (k === i ? { ...y, value: e.target.value } : y)) }), `meta.${i}.value`)} />
              <button type="button" className="btn btn-s btn-quiet btn-danger" aria-label={`Remove data strip cell ${i + 1}`} onClick={() => p.onFields((x) => ({ ...x, meta: x.meta.filter((_, k) => k !== i) }), "meta")}>
                Remove
              </button>
              <div className={styles.full}>
                <IssueList issues={p.issuesFor(`slides.${index}.meta.${i}`)} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.hint}>No data strip. Add date, time and room so people know when and where.</p>
      )}
      <button type="button" className="btn btn-s" disabled={meta.length >= 4} onClick={() => p.onFields((x) => ({ ...x, meta: [...x.meta, { label: "Label", value: "Value" }] }), "meta")}>
        Add a cell
      </button>
    </Group>
  );
}

function PartnersGroup(p: Props & { only?: number }) {
  const { index, slide } = p;
  const f = slide.fields;
  const logos = f.partners ?? [];
  const setL = (i: number, patch: Partial<(typeof logos)[number]>, key: string) => p.onFields((x) => ({ ...x, partners: (x.partners ?? []).map((y, k) => (k === i ? { ...y, ...patch } : y)) }), key);
  const shown = p.only !== undefined ? [p.only] : logos.map((_, i) => i);
  return (
    <Group title="Partner logos" note={p.only === undefined ? `${logos.length} of 3` : undefined}>
      <Seg label="Where they go" name={`place-${slide.id}`} value={f.partnerPlace ?? "none"} options={PLACES} onChange={(v: PartnerPlace) => p.onFields((x) => ({ ...x, partnerPlace: v }), "partnerPlace")} />
      {f.partnerPlace === "footer" ? (
        <EInput label="Footer label" path={`slides.${index}.partnerLabel`} value={f.partnerLabel ?? ""} maxLength={60} placeholder="In partnership with" onChange={(e) => p.onFields((x) => ({ ...x, partnerLabel: e.target.value }), "partnerLabel")} />
      ) : null}
      {logos.length && (f.partnerPlace ?? "none") === "none" ? <p className={styles.hint}>Logos are hidden until you pick header or footer.</p> : null}
      <ol className={styles.rows}>
        {shown.map((i) => {
          const lg = logos[i];
          if (!lg) return null;
          return (
            <li key={i} className={styles.stack} data-path={`slides.${index}.partners.${i}`} tabIndex={-1}>
              <div className={styles.rowHead}>
                <b>Logo {i + 1}</b>
                <span className={styles.tools}>
                  <button type="button" className="btn btn-s btn-quiet" disabled={i === 0} aria-label={`Move logo ${i + 1} left`} onClick={() => p.onFields((x) => ({ ...x, partners: move(x.partners ?? [], i, -1) }), "partners")}>
                    Earlier
                  </button>
                  <button
                    type="button"
                    className="btn btn-s btn-quiet btn-danger"
                    aria-label={`Remove logo ${i + 1}`}
                    onClick={() => {
                      p.onFields((x) => ({ ...x, partners: (x.partners ?? []).filter((_, k) => k !== i) }), "partners");
                      if (p.only !== undefined) p.onSelect({ kind: "slide" });
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
              {p.partners.length ? (
                <div className={styles.field}>
                  <label htmlFor={fid(`slides.${index}.partners.${i}.lib`)}>From the library</label>
                  <select
                    id={fid(`slides.${index}.partners.${i}.lib`)}
                    className="input"
                    value={lg.partnerId ?? ""}
                    onChange={(e) => {
                      const lib = p.partners.find((x) => x.id === e.target.value);
                      setL(i, lib ? { src: lib.logo ?? lg.src, name: lib.name, tone: lib.tone, partnerId: lib.id } : { partnerId: undefined }, `partners.${i}`);
                    }}
                  >
                    <option value="">Not from the library</option>
                    {p.partners.map((x) => (
                      <option key={x.id} value={x.id} disabled={!x.logo}>
                        {x.name}
                        {x.logo ? "" : " (no logo yet)"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <ImageDrop kind="logo" mode={p.uploadMode} compact current={lg.src || null} onUploaded={(a) => setL(i, { src: a.url, partnerId: undefined }, `partners.${i}`)} />
              <EInput label="Partner name" path={`slides.${index}.partners.${i}.name`} value={lg.name} maxLength={100} hint="Used as the logo’s alt text." onChange={(e) => setL(i, { name: e.target.value }, `partners.${i}.name`)} />
              <Seg label="Tone" name={`tone-${slide.id}-${i}`} value={lg.tone} options={TONES} onChange={(v: LogoTone) => setL(i, { tone: v }, `partners.${i}.tone`)} />
              <IssueList issues={p.issuesFor(`slides.${index}.partners.${i}`)} />
            </li>
          );
        })}
      </ol>
      {p.only === undefined ? (
        <button
          type="button"
          className="btn btn-s"
          disabled={logos.length >= 3}
          onClick={() => p.onFields((x) => ({ ...x, partners: [...(x.partners ?? []), { src: "", name: "", tone: "original" }], partnerPlace: x.partnerPlace && x.partnerPlace !== "none" ? x.partnerPlace : "footer" }), "partners")}
        >
          Add a logo
        </button>
      ) : null}
    </Group>
  );
}

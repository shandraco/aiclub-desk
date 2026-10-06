"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage, TextArea, TextField } from "@/components/forms/Field";
import { ImageDrop } from "@/components/upload/ImageDrop";
import type { FormState } from "@/lib/actions";
import { Dialog } from "@/lib/team/ui/Dialog";
import { savePartner } from "../actions";
import { LogoGrounds, toneWarning, type Tone } from "./LogoGrounds";
import styles from "../library.module.css";

export interface PartnerDraft {
  id: string;
  name: string;
  instagram: string;
  linkedin: string;
  notes: string;
  tone: Tone;
  logo: { id: string; url: string } | null;
}

type Mode = "blob" | "dev" | "off";

export function PartnerEditButton({ partner, mode }: { partner?: PartnerDraft; mode: Mode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={partner ? "btn btn-s" : "btn btn-primary"} onClick={() => setOpen(true)} aria-label={partner ? `Edit ${partner.name}` : undefined}>
        {partner ? "Edit" : "Add partner"}
      </button>
      {open ? (
        <Dialog title={partner ? `Edit ${partner.name}` : "Add a partner"} onClose={() => setOpen(false)} wide>
          <PartnerForm partner={partner} mode={mode} onDone={() => setOpen(false)} />
        </Dialog>
      ) : null}
    </>
  );
}

const TONES: { value: Tone; label: string }[] = [
  { value: "original", label: "Original colours" },
  { value: "white", label: "All white" },
  { value: "black", label: "All black" },
];

function PartnerForm({ partner, mode, onDone }: { partner?: PartnerDraft; mode: Mode; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePartner, {});
  const v = state.values;
  const [logo, setLogo] = useState(partner?.logo ?? null);
  const [tone, setTone] = useState<Tone>((v?.logoTone as Tone) ?? partner?.tone ?? "original");
  const [name, setName] = useState(v?.name ?? partner?.name ?? "");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const warn = logo ? toneWarning(tone) : null;
  return (
    <form action={action} noValidate className={styles.editor}>
      {partner ? <input type="hidden" name="id" value={partner.id} /> : null}
      <input type="hidden" name="logoId" value={logo?.id ?? ""} />
      <div className={styles.editorFields}>
        <TextField label="Name" name="name" required data-autofocus value={name} onChange={(e) => setName(e.target.value)} error={state.errors?.name} autoComplete="off" />
        <div className="grid-2">
          <TextField label="Instagram" name="instagram" defaultValue={v?.instagram ?? (partner?.instagram ? `@${partner.instagram}` : "")} hint="@handle or profile link, for tagging." error={state.errors?.instagram} autoCapitalize="none" spellCheck={false} autoComplete="off" />
          <TextField label="LinkedIn" name="linkedin" defaultValue={v?.linkedin ?? partner?.linkedin ?? ""} hint="Company page link, like linkedin.com/company/name." error={state.errors?.linkedin} autoCapitalize="none" spellCheck={false} autoComplete="off" />
        </div>
        <TextArea label="Notes" name="notes" rows={3} defaultValue={v?.notes ?? partner?.notes ?? ""} hint="Who the contact is, and any rules for using their logo." error={state.errors?.notes} />
      </div>
      <div className={styles.editorPhoto}>
        <ImageDrop kind="logo" mode={mode} label="Logo" current={logo?.url} onUploaded={(a) => setLogo({ id: a.id, url: a.url })} />
        {!logo ? <p className="hint">Use a PNG with a transparent background, or an SVG. A logo on a white box looks pasted on.</p> : null}
        <fieldset className="field">
          <legend className="label">Default tone</legend>
          <div className="seg">
            {TONES.map((t) => (
              <label key={t.value}>
                <input type="radio" name="logoTone" value={t.value} checked={tone === t.value} onChange={() => setTone(t.value)} />
                {t.label}
              </label>
            ))}
          </div>
          {state.errors?.logoTone ? <span className="error">{state.errors.logoTone}</span> : null}
        </fieldset>
        <div>
          <LogoGrounds url={logo?.url ?? null} tone={tone} name={name || "Partner"} />
          <p className={styles.groundLabel}>On the ivory ground, and on the black ground.</p>
        </div>
        {warn ? <p className="notice notice-spark">{warn}</p> : null}
      </div>
      <div className={styles.editorFoot}>
        <FormMessage message={state.ok ? undefined : state.message} />
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : partner ? "Save changes" : "Add partner"}</button>
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </form>
  );
}

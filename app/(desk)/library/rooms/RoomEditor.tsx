"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage, TextArea, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { Dialog } from "@/lib/team/ui/Dialog";
import { saveRoom } from "../actions";
import styles from "../library.module.css";

export interface RoomDraft {
  id: string;
  name: string;
  short: string;
  notes: string;
}

export function RoomEditButton({ room }: { room?: RoomDraft }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={room ? "btn btn-s" : "btn btn-primary"} onClick={() => setOpen(true)} aria-label={room ? `Edit ${room.name}` : undefined}>
        {room ? "Edit" : "Add room"}
      </button>
      {open ? (
        <Dialog title={room ? `Edit ${room.name}` : "Add a room"} onClose={() => setOpen(false)}>
          <RoomForm room={room} onDone={() => setOpen(false)} />
        </Dialog>
      ) : null}
    </>
  );
}

function RoomForm({ room, onDone }: { room?: RoomDraft; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRoom, {});
  const v = state.values;
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} noValidate>
      {room ? <input type="hidden" name="id" value={room.id} /> : null}
      <TextField label="Full name" name="name" required data-autofocus defaultValue={v?.name ?? room?.name ?? ""} hint="As in captions: “Rhatigan Student Center 233”." error={state.errors?.name} autoComplete="off" />
      <TextField label="Short form for graphics" name="short" required maxLength={24} defaultValue={v?.short ?? room?.short ?? ""} hint="Fits the data strip: “RSC 233”." error={state.errors?.short} autoComplete="off" />
      <TextArea label="Notes" name="notes" rows={3} defaultValue={v?.notes ?? room?.notes ?? ""} hint="Capacity, how to book it, where the projector cable is." error={state.errors?.notes} />
      <div className={styles.formFoot}>
        <FormMessage message={state.ok ? undefined : state.message} />
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : room ? "Save changes" : "Add room"}</button>
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </form>
  );
}

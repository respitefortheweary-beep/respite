"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createHouse, saveHouse } from "../../actions";
import { Card, CardHead, Label, btnPrimary, btnQuiet, input } from "../ui";
import { SubmitButton } from "../submit";

type HouseFields = { id: string; name: string; address: string; town: string; summary: string; hidden: boolean };

function Fields({ house, autoFocus = false }: { house?: HouseFields; autoFocus?: boolean }) {
  return (
    <>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-oat px-4 py-3.5 sm:col-span-2">
        <span>
          <span className="block font-medium">Show on the site</span>
          <span className="block text-[0.86rem] text-moss">Off keeps this house and every room in it out of every public page.</span>
        </span>
        <input type="checkbox" name="visible" defaultChecked={!house?.hidden} className="peer sr-only" />
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-ink/20 transition-colors duration-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 after:ease-[var(--ease-out)] peer-checked:bg-ink peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-porch"
        />
      </label>
      <label className="sm:col-span-2">
        <Label>House name</Label>
        <input name="name" defaultValue={house?.name} required maxLength={120} placeholder="The Maple Street House" className={input} autoFocus={autoFocus} />
      </label>
      <label>
        <Label>Street address</Label>
        <input name="address" defaultValue={house?.address} maxLength={200} placeholder="12 Maple St, Petersburg, VA 23803" className={input} />
        <span className="mt-1.5 block text-[0.82rem] text-moss">For the dashboard only. The site shows the town; people get the exact address when they book a tour.</span>
      </label>
      <label>
        <Label>Town</Label>
        <input name="town" defaultValue={house?.town} maxLength={80} placeholder="Petersburg, Virginia" className={input} />
        <span className="mt-1.5 block text-[0.82rem] text-moss">The short place name people see on room cards.</span>
      </label>
      <label className="sm:col-span-2">
        <Label>A line about the house</Label>
        <textarea name="summary" defaultValue={house?.summary} rows={3} maxLength={600} placeholder="Quiet street, five minutes from the bus line and the VA clinic." className={`${input} h-auto py-2.5 leading-relaxed`} />
      </label>
    </>
  );
}

function Error({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-ember/10 px-3.5 py-2.5 text-[0.88rem] text-ember ring-1 ring-ember/25 sm:col-span-2">
      {text}
    </p>
  );
}

/** Closed by default, like Add a room: most visits are to change a room, not to add a property. */
export function NewHouse() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createHouse, null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnQuiet}>
        <Plus size={16} /> Add a house
      </button>
    );
  return (
    <Card className="w-full">
      <CardHead title="Add a house" hint="Then add its rooms. Each house numbers its own beds from Bed 1." />
      <form action={action} className="grid gap-4 p-5 pt-4 sm:grid-cols-2 sm:p-6 sm:pt-4">
        <Fields autoFocus />
        <Error text={state?.error} />
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row">
          <button type="button" onClick={() => setOpen(false)} className={btnQuiet}>
            Cancel
          </button>
          <SubmitButton className={`${btnPrimary} disabled:opacity-60`}>Add house</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function HouseForm({ house }: { house: HouseFields }) {
  const [state, action] = useActionState(saveHouse.bind(null, house.id), null);
  return (
    <form action={action} className="grid gap-4 p-5 pt-4 sm:grid-cols-2 sm:p-6 sm:pt-4">
      <Fields house={house} />
      <Error text={state?.error} />
      <div className="sm:col-span-2">
        <SubmitButton className={`${btnPrimary} w-full disabled:opacity-60 sm:w-auto`} done={state?.error ? undefined : "Saved"}>
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

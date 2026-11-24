"use client";
import { useActionState } from "react";
import { saveHouse } from "../../actions";
import { Label, btnPrimary, input } from "../ui";
import { SubmitButton } from "../submit";
import { AMENITY_GROUPS } from "@/lib/amenities";

type HouseFields = { id: string; name: string; address: string; town: string; summary: string; hidden: boolean; amenities: string[] };

function Fields({ house }: { house?: HouseFields }) {
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
        <input name="name" defaultValue={house?.name} required maxLength={120} placeholder="The Maple Street House" className={input} />
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

/** Tick what the house has. The house page lists these under "What this house offers". */
function Amenities({ have }: { have: string[] }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="font-medium">What this house offers</legend>
      <p className="mt-0.5 text-[0.86rem] text-moss">Tick everything the house has. People see the ticked ones on the house page.</p>
      <input type="hidden" name="amenitiesShown" value="1" />
      <div className="mt-3 space-y-4">
        {AMENITY_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[0.85rem] font-semibold text-moss">{g.title}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.items.map(({ key, label, icon: Icon }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-line transition-colors hover:bg-oat has-[:checked]:bg-porch/[.07] has-[:checked]:ring-porch/40"
                >
                  <input type="checkbox" name="amenity" value={key} defaultChecked={have.includes(key)} className="h-4 w-4 shrink-0 accent-[var(--porch)]" />
                  <Icon size={17} className="shrink-0 text-ink/70" aria-hidden />
                  <span className="text-[0.92rem]">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
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

export function HouseForm({ house }: { house: HouseFields }) {
  const [state, action] = useActionState(saveHouse.bind(null, house.id), null);
  return (
    <form action={action} className="grid gap-4 p-5 pt-4 sm:grid-cols-2 sm:p-6 sm:pt-4">
      <Fields house={house} />
      <Amenities have={house.amenities} />
      <Error text={state?.error} />
      <div className="sm:col-span-2">
        <SubmitButton className={`${btnPrimary} w-full disabled:opacity-60 sm:w-auto`} done={state?.error ? undefined : "Saved"}>
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

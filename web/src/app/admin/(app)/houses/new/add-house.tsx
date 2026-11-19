"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { addHouse, createRoom } from "../../../actions";
import { sendMedia } from "@/lib/send-media";
import { Card, CardHead, Label, btnPrimary, btnQuiet, input } from "../../ui";
import { MediaPicker } from "../../media";

type RoomDraft = { key: number; name: string; beds: number; rent: string };

let nextKey = 1;
const blankRoom = (n: number): RoomDraft => ({ key: nextKey++, name: `Room ${n}`, beds: 1, rent: "" });

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const b = "press grid h-11 w-11 place-items-center rounded-xl bg-paper ring-1 ring-line-strong transition-colors hover:bg-ink/[.04] disabled:opacity-35";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={b} disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label="One bed fewer">
        <Minus size={15} />
      </button>
      <output className="mono tabular w-8 text-center text-[1.1rem] font-semibold" aria-live="polite">
        {value}
      </output>
      <button type="button" className={b} disabled={value >= 6} onClick={() => onChange(value + 1)} aria-label="One bed more">
        <Plus size={15} />
      </button>
    </div>
  );
}

export function AddHouseForm({ canUpload }: { canUpload: boolean }) {
  const router = useRouter();
  const [houseMedia, setHouseMedia] = useState<File[]>([]);
  const [rooms, setRooms] = useState<RoomDraft[]>(() => [blankRoom(1)]);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const edit = (key: number, change: Partial<RoomDraft>) => setRooms((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const totalBeds = rooms.reduce((n, r) => n + r.beds, 0);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const blank = rooms.findIndex((r) => !r.name.trim() || r.rent === "");
    if (blank >= 0) {
      setError(`Room ${blank + 1} needs a name and a monthly rent.`);
      return;
    }
    setBusy("Adding the house");
    const form = new FormData(e.currentTarget);
    if (visible) form.set("visible", "on");
    else form.delete("visible");
    const house = await addHouse(form);
    if (!house.id) {
      setBusy("");
      setError(house.error ?? "The house couldn't be added.");
      return;
    }
    const houseId = house.id;
    // past this point the house exists: a photo that fails can be added again on its page, so carry on
    let failed = false;
    if (houseMedia.length) {
      const r = await sendMedia("houses", houseId, houseMedia, undefined, {
        onProgress: ({ at, of, video, sent = 0, total = 0 }) =>
          setBusy(`House photos and videos: ${at} of ${of}${video && total ? ` · ${Math.min(100, Math.round((sent / total) * 100))}%` : ""}`),
      });
      failed ||= !!r.error;
    }
    for (const [i, r] of rooms.entries()) {
      setBusy(`Adding ${r.name.trim()} (${i + 1} of ${rooms.length})`);
      const roomForm = new FormData();
      roomForm.set("name", r.name.trim());
      roomForm.set("kind", r.beds === 1 ? "PRIVATE" : "SHARED");
      roomForm.set("beds", String(r.beds));
      roomForm.set("floor", "Ground");
      roomForm.set("bathroom", "Shared");
      roomForm.set("rent", r.rent);
      roomForm.set("houseId", houseId);
      roomForm.set("hidden", String(!visible));
      const room = await createRoom(roomForm);
      if (!room.id) failed = true;
    }
    router.push(`/admin/houses?house=${failed ? "partly" : "added"}#house-${houseId}`);
  };

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-5">
      <Card>
        <CardHead title="1. The house" hint="Its name, where it is, and all its photos and videos: outside, shared spaces and the rooms." />
        <div className="grid gap-4 p-5 pt-4 sm:grid-cols-2 sm:p-6 sm:pt-4">
          <label className="sm:col-span-2">
            <Label>House name</Label>
            <input name="name" required maxLength={120} placeholder="The Maple Street House" className={input} autoFocus />
          </label>
          <label>
            <Label>Street address</Label>
            <input name="address" maxLength={200} placeholder="12 Maple St, Petersburg, VA 23803" className={input} />
            <span className="mt-1.5 block text-[0.82rem] text-moss">Kept private. People get it when they book a tour.</span>
          </label>
          <label>
            <Label>Town</Label>
            <input name="town" maxLength={80} placeholder="Petersburg, Virginia" className={input} />
            <span className="mt-1.5 block text-[0.82rem] text-moss">This is what the site shows.</span>
          </label>
          <label className="sm:col-span-2">
            <Label>A line about the house</Label>
            <textarea name="summary" rows={2} maxLength={600} placeholder="Quiet street, five minutes from the bus line and the VA clinic." className={`${input} h-auto py-2.5 leading-relaxed`} />
          </label>
          {canUpload && (
            <div className="sm:col-span-2">
              <Label>House photos and videos</Label>
              <MediaPicker files={houseMedia} onChange={setHouseMedia} />
              <span className="mt-1.5 block text-[0.82rem] text-moss">The front, the kitchen, the living room, the rooms, the yard. The first photo is the cover.</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHead
          title="2. The rooms"
          hint={
            <>
              {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · <span className="mono tabular">{totalBeds}</span> bed {totalBeds === 1 ? "space" : "spaces"}
            </>
          }
        />
        <ol className="divide-y divide-line border-t border-line">
          {rooms.map((r, i) => (
            <li key={r.key} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto_10rem] sm:items-end sm:p-6">
              <label>
                <Label>Room name</Label>
                <input value={r.name} onChange={(e) => edit(r.key, { name: e.target.value })} required maxLength={120} className={input} />
              </label>
              <div>
                <Label>Bed spaces</Label>
                <Stepper value={r.beds} onChange={(beds) => edit(r.key, { beds })} label={`Bed spaces in ${r.name || `room ${i + 1}`}`} />
              </div>
              <label>
                <Label>Rent per bed, a month ($)</Label>
                <input value={r.rent} onChange={(e) => edit(r.key, { rent: e.target.value })} type="number" inputMode="decimal" min={0} required className={`${input} mono tabular`} />
              </label>
              <p className="text-[0.84rem] text-moss sm:col-span-3">{r.beds === 1 ? "Single room: one person." : `Shared room: ${r.beds} people, one bed space each.`}</p>
              {rooms.length > 1 && (
                <button type="button" onClick={() => setRooms((rs) => rs.filter((x) => x.key !== r.key))} className="press inline-flex items-center gap-1.5 justify-self-start text-[0.86rem] text-moss hover:text-ember sm:col-span-3">
                  <Trash2 size={14} /> Take this room out
                </button>
              )}
            </li>
          ))}
        </ol>
        <div className="border-t border-line p-5 sm:p-6">
          <button type="button" onClick={() => setRooms((rs) => [...rs, blankRoom(rs.length + 1)])} disabled={rooms.length >= 30} className={`${btnQuiet} w-full sm:w-auto`}>
            <Plus size={16} /> Add another room
          </button>
        </div>
      </Card>

      <Card>
        <label className="flex cursor-pointer items-center justify-between gap-4 p-5 sm:p-6">
          <span>
            <span className="block font-medium">Put it on the site now</span>
            <span className="block text-[0.86rem] text-moss">Off keeps the house and its rooms hidden until you switch them on.</span>
          </span>
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-ink/20 transition-colors duration-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 after:ease-[var(--ease-out)] peer-checked:bg-ink peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-porch"
          />
        </label>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-ember/10 px-3.5 py-2.5 text-[0.88rem] text-ember ring-1 ring-ember/25">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" onClick={() => router.back()} disabled={!!busy} className={btnQuiet}>
          Cancel
        </button>
        <button disabled={!!busy} className={`${btnPrimary} disabled:opacity-70`}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {busy}
            </>
          ) : (
            `Add house and ${rooms.length} ${rooms.length === 1 ? "room" : "rooms"}`
          )}
        </button>
      </div>
      {busy && <p className="text-[0.86rem] text-moss">Keep this page open until it finishes. Videos can take a minute.</p>}
    </form>
  );
}

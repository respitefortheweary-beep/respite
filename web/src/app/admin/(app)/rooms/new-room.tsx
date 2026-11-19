"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createRoom } from "../../actions";
import { Card, CardHead, Label, btnPrimary, btnQuiet, input, select } from "../ui";

/** Closed by default: most visits are to change a date, not to build a room. */
export function NewRoom({ houseId, houseName }: { houseId?: string; houseName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("SHARED");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");


  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setBusy("Adding the room");
    const form = new FormData(e.currentTarget);
    const room = await createRoom(form);
    if (!room.id) {
      setBusy("");
      setError(room.error ?? "The room couldn't be added.");
      return;
    }
    router.push(`/admin/rooms/${room.id}?new=1`);
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnQuiet}>
        <Plus size={16} /> Add a room{houseName ? <span className="sr-only"> to {houseName}</span> : null}
      </button>
    );

  return (
    <Card className="w-full">
      <CardHead title={houseName ? `Add a room to ${houseName}` : "Add a room"} hint="It stays hidden from the site until you switch it on. Photos and videos go on the house." />
      <form onSubmit={submit} className="grid gap-4 p-5 pt-4 sm:grid-cols-2 sm:p-6 sm:pt-4">
        {houseId && <input type="hidden" name="houseId" value={houseId} />}
        <label className="sm:col-span-2">
          <Label>Room name</Label>
          <input name="name" required maxLength={120} placeholder="The Garden Room" className={input} autoFocus />
        </label>
        <label>
          <Label>Kind</Label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={select}>
            <option value="SHARED">Shared, more than one bed</option>
            <option value="PRIVATE">Single room, one bed</option>
          </select>
        </label>
        <label>
          <Label>Beds</Label>
          {kind === "PRIVATE" ? (
            <input value="1" disabled className={`${input} mono tabular opacity-60`} />
          ) : (
            <select name="beds" defaultValue="2" className={`${select} mono tabular`}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          <Label>Floor</Label>
          <select name="floor" defaultValue="Ground" className={select}>
            <option>Ground</option>
            <option>Upper</option>
          </select>
        </label>
        <label>
          <Label>Bathroom</Label>
          <select name="bathroom" defaultValue="Shared" className={select}>
            <option>Shared</option>
            <option>Private</option>
          </select>
        </label>
        <label>
          <Label>Monthly rent{kind === "SHARED" ? " per bed" : ""} ($)</Label>
          <input name="rent" type="number" inputMode="decimal" min={0} required className={`${input} mono tabular`} />
        </label>
        <label>
          <Label>Deposit ($)</Label>
          <input name="deposit" type="number" inputMode="decimal" min={0} className={`${input} mono tabular`} />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-ember/10 px-3.5 py-2.5 text-[0.88rem] text-ember ring-1 ring-ember/25 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row">
          <button type="button" onClick={() => setOpen(false)} disabled={!!busy} className={btnQuiet}>
            Cancel
          </button>
          <button disabled={!!busy} className={`${btnPrimary} disabled:opacity-70`}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {busy}
              </>
            ) : (
              "Add room"
            )}
          </button>
        </div>
      </form>
    </Card>
  );
}
